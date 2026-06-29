import { OnboardingStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import prisma from "../../db.server";
import {
  assertOrderCreateAllowedAtomic,
  assertProductCreateAllowedAtomic,
} from "../billing-enforcement.server";
import {
  BootstrapSubscriptionError,
  ensureSubscriptionForActiveStore,
  terminateSubscriptionOnUninstall,
} from "../billing.server";
import {
  CustomerDataExportScopeError,
  gatherCustomerDataExport,
  validateCustomerDataExportScope,
} from "../gdpr.server";
import { cancelStoreJobsOnUninstall } from "../job.server";
import {
  advanceOnboarding,
  getOrCreateStoreOnboarding,
  resumeOnboarding,
} from "../onboarding.server";
import { syncOrdersFromShopify } from "../orders.server";
import {
  handleAppUninstalledWebhook,
  isStaleUninstallWebhook,
  upsertStoreFromSession,
} from "../store.server";
import {
  assertStartupReadiness,
  StartupReadinessError,
} from "../startup-readiness.server";
import {
  decryptSecretToken,
  encryptSecretToken,
} from "../token-crypto.server";
import type { Session } from "@shopify/shopify-api";
import {
  ORDER_GID,
  SHOP,
  STORE_ID,
  buildOrderNode,
  mockOrdersSyncPageResponse,
  testHarness,
} from "./helpers/fixtures";

beforeEach(() => {
  const harness = testHarness();
  harness.resetDbState();
  vi.clearAllMocks();
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("F.6.22 C-02/C-03 — orders sync false completion", () => {
  it("quarantines stale-skipped orders instead of marking import complete", async () => {
    const harness = testHarness();
    harness.seedOrder({
      shopifyOrderId: ORDER_GID,
      orderName: "#1001",
      shopifyUpdatedAt: new Date("2026-06-20T12:00:00.000Z"),
    });

    harness.mockAdminGraphql.mockResolvedValue(
      mockOrdersSyncPageResponse({
        orders: [
          buildOrderNode({
            id: ORDER_GID,
            name: "#1001",
            updatedAt: "2026-01-15T10:00:00Z",
          }),
        ],
      }),
    );

    const result = await syncOrdersFromShopify({
      storeId: STORE_ID,
      shop: SHOP,
      admin: { graphql: harness.mockAdminGraphql },
    });

    expect(result.success).toBe(false);
    expect(result.quarantinedOrderIds).toContain(ORDER_GID);
    expect(harness.getStore().historicalOrdersImportDone).toBe(false);
  });

  it("quarantines orders with incomplete line-item normalization", async () => {
    const harness = testHarness();
    harness.mockAdminGraphql.mockResolvedValue(
      mockOrdersSyncPageResponse({
        orders: [
          buildOrderNode({
            id: "gid://shopify/Order/1002",
            name: "#1002",
            processedAt: null,
          }),
        ],
      }),
    );

    const result = await syncOrdersFromShopify({
      storeId: STORE_ID,
      shop: SHOP,
      admin: { graphql: harness.mockAdminGraphql },
    });

    expect(result.success).toBe(false);
    expect(result.quarantinedOrderIds).toContain("gid://shopify/Order/1002");
    expect(harness.getStore().historicalOrdersImportDone).toBe(false);
  });
});

describe("F.6.22 C-04 — billing TOCTOU", () => {
  it("blocks product create when subscription is cancelled inside locked transaction", async () => {
    await terminateSubscriptionOnUninstall(STORE_ID);

    const check = await prisma.$transaction(async (tx) =>
      assertProductCreateAllowedAtomic(tx, STORE_ID),
    );

    expect(check.allowed).toBe(false);
    expect(check.reason).toBe("cancelled");
  });

  it("blocks order create when subscription is cancelled inside locked transaction", async () => {
    await terminateSubscriptionOnUninstall(STORE_ID);

    const check = await prisma.$transaction(async (tx) =>
      assertOrderCreateAllowedAtomic(tx, STORE_ID),
    );

    expect(check.allowed).toBe(false);
    expect(check.reason).toBe("cancelled");
  });
});

describe("F.6.22 C-05 — failed onboarding recovery", () => {
  it("resumes failed onboarding instead of dead-ending", async () => {
    await getOrCreateStoreOnboarding(STORE_ID);
    const onboarding = testHarness().getOnboarding()!;
    onboarding.status = OnboardingStatus.failed;
    onboarding.productSyncStatus = "failed";
    onboarding.failedAt = new Date();
    onboarding.lastErrorMessage = "bootstrap_products_sync_failed";

    const result = await resumeOnboarding(STORE_ID);

    expect(result.action).toBe("resumed");
    expect(result.onboarding.status).not.toBe(OnboardingStatus.failed);
  });

  it("resets failed onboarding status on uninstall", async () => {
    await getOrCreateStoreOnboarding(STORE_ID);
    const onboarding = testHarness().getOnboarding()!;
    onboarding.status = OnboardingStatus.failed;

    await cancelStoreJobsOnUninstall(STORE_ID);

    expect(testHarness().getOnboarding()?.status).toBe(OnboardingStatus.not_started);
    expect(testHarness().getOnboarding()?.failedAt).toBeNull();
  });

  it("does not dead-end advanceOnboarding after uninstall reset", async () => {
    await getOrCreateStoreOnboarding(STORE_ID);
    const onboarding = testHarness().getOnboarding()!;
    onboarding.status = OnboardingStatus.failed;
    onboarding.productSyncStatus = "not_started";
    onboarding.inventorySyncStatus = "not_started";
    onboarding.ordersSyncStatus = "not_started";

    await cancelStoreJobsOnUninstall(STORE_ID);

    const result = await advanceOnboarding({ storeId: STORE_ID });
    expect(result.action).not.toBe("failed");
  });
});

describe("F.6.22 H-03 — uninstall stale protection without header", () => {
  it("treats uninstall as stale when auth is newer than webhook claim time", async () => {
    const harness = testHarness();
    harness.getStore().lastAuthenticatedAt = new Date("2026-06-02T12:00:00.000Z");

    const stale = await isStaleUninstallWebhook(
      SHOP,
      new Date("2026-06-01T11:00:00.000Z"),
    );

    expect(stale).toBe(true);
  });

  it("ignores delayed uninstall after reinstall when header is absent", async () => {
    const harness = testHarness();
    harness.getStore().lastAuthenticatedAt = new Date("2026-06-02T12:00:00.000Z");
    harness.getStore().accessToken = "restored-token";
    harness.getStore().active = true;

    const claimTime = new Date("2026-06-01T11:00:00.000Z");
    const eventId = "event-stale-uninstall-f622";
    harness.dbState.webhookEvents.set("wh-f622-stale-no-header", {
      id: eventId,
      storeId: STORE_ID,
      shopifyWebhookId: "wh-f622-stale-no-header",
      shop: SHOP,
      topic: "app/uninstalled",
      processedSuccessfully: false,
      processedAt: null,
      createdAt: claimTime,
      processingOwner: null,
      processingExpiresAt: null,
    });
    harness.dbState.webhookEventsById.set(
      eventId,
      harness.dbState.webhookEvents.get("wh-f622-stale-no-header")!,
    );

    const result = await handleAppUninstalledWebhook({
      shop: SHOP,
      topic: "app/uninstalled",
      webhookId: "wh-f622-stale-no-header",
    });

    expect(result).toEqual({ success: true, stale: true });
    expect(harness.getStore().active).toBe(true);
    expect(harness.getStore().accessToken).toBe("restored-token");
  });
});

describe("F.6.22 H-08 — GDPR export scope validation", () => {
  it("rejects exports containing orders outside the requested scope", () => {
    expect(() =>
      validateCustomerDataExportScope(
        {
          shopifyCustomerId: "1",
          storeId: STORE_ID,
          dataRequestId: "req",
          storedCustomerProfile: {
            email: false,
            phone: false,
            name: false,
            note: "test",
          },
          orders: [
            {
              shopifyOrderId: ORDER_GID,
              orderName: "#1001",
              shopifyCreatedAt: "2026-01-01T00:00:00.000Z",
              shopifyUpdatedAt: "2026-01-01T00:00:00.000Z",
              currencyCode: "USD",
              totalPriceAmount: "10.00",
              isPaid: true,
              isTest: false,
            },
          ],
          orderLineItems: [],
          webhookEvents: { note: "none", records: [] },
        },
        ["gid://shopify/Order/9999"],
      ),
    ).toThrow(CustomerDataExportScopeError);
  });

  it("accepts scoped exports built only from requested order GIDs", async () => {
    const harness = testHarness();
    harness.seedOrder({ shopifyOrderId: ORDER_GID, orderName: "#1001" });
    harness.seedOrder({
      shopifyOrderId: "gid://shopify/Order/9999",
      orderName: "#9999",
    });

    const exportPayload = await gatherCustomerDataExport({
      storeId: STORE_ID,
      shopifyCustomerId: "42",
      dataRequestId: "req",
      orderGids: [ORDER_GID],
    });

    expect(() =>
      validateCustomerDataExportScope(exportPayload, [ORDER_GID]),
    ).not.toThrow();
    expect(exportPayload.orders).toHaveLength(1);
  });
});

describe("F.6.22 H-13 — token encryption at rest", () => {
  it("round-trips encrypted store tokens", () => {
    const encrypted = encryptSecretToken("shpat_live_secret");
    expect(encrypted).toMatch(/^spenc:v1:/);
    expect(decryptSecretToken(encrypted)).toBe("shpat_live_secret");
  });

  it("stores encrypted access tokens during store upsert", async () => {
    const harness = testHarness();
    const admin = {
      graphql: vi.fn().mockResolvedValue(
        Response.json({
          data: {
            shop: {
              id: "gid://shopify/Shop/1",
              name: "Store",
              currencyCode: "USD",
              ianaTimezone: "UTC",
            },
          },
        }),
      ),
    };

    await upsertStoreFromSession(
      {
        shop: SHOP,
        accessToken: "shpat_live_secret",
        id: "offline_session",
        isOnline: false,
        state: "state",
        scope: "read_products",
      } as Session,
      admin as never,
    );

    const stored = harness.getStore().accessToken;
    expect(stored).toMatch(/^spenc:v1:/);
    expect(decryptSecretToken(stored)).toBe("shpat_live_secret");
  });
});

describe("F.6.22 H-01/H-02 — install bootstrap safety", () => {
  it("throws when subscription bootstrap cannot create a plan-backed subscription", async () => {
    const harness = testHarness();
    harness.dbState.plans.clear();
    harness.dbState.plansBySlug.clear();

    await expect(ensureSubscriptionForActiveStore(STORE_ID)).rejects.toBeInstanceOf(
      BootstrapSubscriptionError,
    );
  });
});

describe("F.6.22 H-10/H-11 — startup readiness enforcement", () => {
  it("throws when required production dependencies are missing", async () => {
    await expect(
      assertStartupReadiness({
        CRON_SECRET: "",
        SHOPIFY_API_KEY: "key",
        DATABASE_URL: "postgres://localhost/test",
        SHOPIFY_APP_URL: "https://app.example.com",
        SHOPIFY_API_SECRET: "secret",
        SCOPES: "read_products,read_inventory,write_products,read_orders",
        TOKEN_ENCRYPTION_KEY: "",
      }),
    ).rejects.toBeInstanceOf(StartupReadinessError);
  });
});
