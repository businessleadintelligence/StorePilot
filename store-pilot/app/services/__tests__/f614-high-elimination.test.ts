import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import prisma from "../../db.server";
import {
  SHOPIFY_ADMIN_API_VERSION,
  SHOPIFY_ADMIN_API_VERSION_STRING,
} from "../../shopify-api-version.server";
import {
  ensureSubscriptionForActiveStore,
  terminateSubscriptionOnUninstall,
} from "../billing.server";
import { getCronWorkerHealth } from "../cron-worker.server";
import {
  buildOrdersIncrementalIdempotencyKey,
  scheduleOrdersIncrementalSync,
} from "../orders-scheduler.server";
import {
  normalizeOrderRow,
  parseOrdersSyncCursorState,
  syncOrdersIncremental,
  upsertOrderRow,
} from "../orders.server";
import { syncProductsFromShopify, upsertVariantRow } from "../product.server";
import { deactivateStoreOnUninstall } from "../store.server";
import {
  evaluateSubscriptionAccess,
  getSubscriptionAccessState,
} from "../subscription.server";
import { JobHeartbeatError } from "../worker.server";
import {
  claimWebhookEvent,
  classifyOrderWebhookSkip,
  gateWebhookEvent,
} from "../webhook.server";
import {
  ORDER_GID,
  PRODUCT_GID,
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

describe("F.6.14 H1 — subscription reinstall lifecycle", () => {
  it("terminates subscription on uninstall and does not grant a second trial on reinstall", async () => {
    await ensureSubscriptionForActiveStore(STORE_ID);
    await prisma.store.update({
      where: { id: STORE_ID },
      data: { firstTrialStartedAt: new Date("2025-01-01T00:00:00.000Z") },
    });

    await deactivateStoreOnUninstall(SHOP);

    const terminated = await prisma.subscription.findUnique({
      where: { storeId: STORE_ID },
    });
    expect(terminated?.status).toBe("cancelled");
    expect(terminated?.endedAt).toBeInstanceOf(Date);

    const restarted = await ensureSubscriptionForActiveStore(STORE_ID);
    expect(restarted?.status).toBe("cancelled");

    const row = await prisma.subscription.findUnique({
      where: { storeId: STORE_ID },
    });
    expect(row?.status).toBe("cancelled");
    expect(row?.trialEndsAt).toBeNull();
  });

  it("does not extend an active trial on repeated ensure calls", async () => {
    const first = await ensureSubscriptionForActiveStore(STORE_ID);
    const second = await ensureSubscriptionForActiveStore(STORE_ID);

    expect(second?.id).toBe(first?.id);
    expect(second?.trialEndsAt?.toISOString()).toBe(
      first?.trialEndsAt?.toISOString(),
    );
  });

  it("terminateSubscriptionOnUninstall is idempotent", async () => {
    await terminateSubscriptionOnUninstall(STORE_ID);
    await terminateSubscriptionOnUninstall(STORE_ID);

    const row = await prisma.subscription.findUnique({
      where: { storeId: STORE_ID },
    });
    expect(row?.status).toBe("cancelled");
  });
});

describe("F.6.14 H2 — inactive store webhook durability", () => {
  it("returns inactive_retry without marking webhook processed", async () => {
    const gate = await gateWebhookEvent({
      shop: SHOP,
      topic: "orders/create",
      webhookId: "wh-inactive-001",
      lookup: { storeId: STORE_ID, active: false },
    });

    expect(gate.outcome).toBe("inactive_retry");

    const event = await prisma.webhookEvent.findUnique({
      where: { shopifyWebhookId: "wh-inactive-001" },
    });
    expect(event).toBeNull();
  });
});

describe("F.6.14 H3 — Shopify API version alignment", () => {
  it("matches runtime export and shopify.app.toml", () => {
    expect(SHOPIFY_ADMIN_API_VERSION).toBeTruthy();
    expect(SHOPIFY_ADMIN_API_VERSION_STRING).toBe("2025-10");

    const toml = readFileSync(
      resolve(process.cwd(), "shopify.app.toml"),
      "utf8",
    );
    expect(toml).toContain(`api_version = "${SHOPIFY_ADMIN_API_VERSION_STRING}"`);
  });
});

describe("F.6.14 H4/H5 — product stale ACK and bootstrap success", () => {
  it("does not count stale_skipped REST webhook writes as upserted", async () => {
    const harness = testHarness();
    const staleAt = new Date("2024-01-01T00:00:00.000Z");
    const newerAt = new Date("2024-06-01T00:00:00.000Z");

    harness.seedProduct({
      shopifyVariantId: "gid://shopify/ProductVariant/9001",
      shopifyProductUpdatedAt: newerAt,
    });

    const row = {
      shopifyProductId: "gid://shopify/Product/9000",
      shopifyVariantId: "gid://shopify/ProductVariant/9001",
      shopifyInventoryItemId: "gid://shopify/InventoryItem/9001",
      title: "Stale webhook",
      sku: "STALE",
      status: "active" as const,
      price: null,
      inventoryQuantity: 1,
      shopifyProductUpdatedAt: staleAt,
    };

    const result = await upsertVariantRow(STORE_ID, row, "webhook");
    expect(result.action).toBe("stale_skipped");
  });

  it("marks product bootstrap failed when skipped rows remain", async () => {
    const harness = testHarness();
    harness.mockAdminGraphql.mockResolvedValue(
      Response.json({
        data: {
          products: {
            edges: [
              {
                node: {
                  id: PRODUCT_GID,
                  title: "Test Product",
                  status: "ACTIVE",
                  variants: {
                    edges: [
                      {
                        node: {
                          id: null,
                          sku: "BAD",
                          price: "1.00",
                          inventoryQuantity: 1,
                          inventoryItem: {
                            id: "gid://shopify/InventoryItem/999",
                            tracked: true,
                          },
                        },
                      },
                    ],
                    pageInfo: { hasNextPage: false, endCursor: null },
                  },
                },
              },
            ],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      }),
    );

    const result = await syncProductsFromShopify({
      storeId: STORE_ID,
      shop: SHOP,
      admin: { graphql: harness.mockAdminGraphql },
    });

    expect(result.skipped).toBeGreaterThan(0);
    expect(result.success).toBe(false);
  });
});

describe("F.6.14 H6 — atomic stale guards", () => {
  it("prevents concurrent product writers from overwriting newer Shopify state", async () => {
    const harness = testHarness();
    const baseline = new Date("2024-06-01T00:00:00.000Z");

    harness.seedProduct({
      shopifyVariantId: "gid://shopify/ProductVariant/7001",
      shopifyProductUpdatedAt: baseline,
    });

    const staleRow = {
      shopifyProductId: "gid://shopify/Product/7000",
      shopifyVariantId: "gid://shopify/ProductVariant/7001",
      shopifyInventoryItemId: "gid://shopify/InventoryItem/7001",
      title: "Stale concurrent",
      sku: "OLD",
      status: "active" as const,
      price: null,
      inventoryQuantity: 1,
      shopifyProductUpdatedAt: new Date("2024-01-01T00:00:00.000Z"),
    };

    const freshRow = {
      ...staleRow,
      title: "Fresh concurrent",
      sku: "NEW",
      shopifyProductUpdatedAt: new Date("2024-07-01T00:00:00.000Z"),
    };

    const [staleResult, freshResult] = await Promise.all([
      upsertVariantRow(STORE_ID, staleRow, "webhook"),
      upsertVariantRow(STORE_ID, freshRow, "webhook"),
    ]);

    expect(staleResult.action).toBe("stale_skipped");
    expect(freshResult.action).toBe("updated");

    const products = await prisma.product.findMany({ where: { storeId: STORE_ID } });
    expect(products[0]?.title).toBe("Fresh concurrent");
  });

  it("prevents concurrent order writers from overwriting newer Shopify state", async () => {
    const harness = testHarness();
    const baseline = new Date("2024-06-01T00:00:00.000Z");

    harness.seedOrder({
      shopifyOrderId: ORDER_GID,
      shopifyUpdatedAt: baseline,
    });

    const staleNormalized = normalizeOrderRow(
      buildOrderNode({
        id: ORDER_GID,
        updatedAt: "2024-01-01T00:00:00.000Z",
        name: "#STALE",
      }),
    );
    const freshNormalized = normalizeOrderRow(
      buildOrderNode({
        id: ORDER_GID,
        updatedAt: "2024-08-01T00:00:00.000Z",
        name: "#FRESH",
      }),
    );
    expect(staleNormalized).toBeTruthy();
    expect(freshNormalized).toBeTruthy();

    const [staleResult, freshResult] = await Promise.all([
      upsertOrderRow(STORE_ID, staleNormalized!),
      upsertOrderRow(STORE_ID, freshNormalized!),
    ]);

    expect(staleResult.staleSkipped).toBe(true);
    expect(freshResult.staleSkipped).toBeUndefined();

    const order = await prisma.order.findUnique({
      where: {
        storeId_shopifyOrderId: {
          storeId: STORE_ID,
          shopifyOrderId: ORDER_GID,
        },
      },
    });
    expect(order?.orderName).toBe("#FRESH");
  });
});

describe("F.6.14 H7 — webhook reclaim single-flight", () => {
  it("allows only one concurrent processor for the same webhook id", async () => {
    const first = await claimWebhookEvent({
      storeId: STORE_ID,
      shop: SHOP,
      topic: "orders/create",
      webhookId: "wh-race-001",
    });
    const second = await claimWebhookEvent({
      storeId: STORE_ID,
      shop: SHOP,
      topic: "orders/create",
      webhookId: "wh-race-001",
    });

    expect(first.status).toBe("claimed");
    expect(second.status).toBe("lease_active");
    expect(second.retryable).toBe(true);
  });
});

describe("F.6.14 H8 — heartbeat failure safety", () => {
  it("surfaces heartbeat loss via JobHeartbeatError", () => {
    expect(new JobHeartbeatError("job_heartbeat_failed").name).toBe(
      "JobHeartbeatError",
    );
  });
});

describe("F.6.14 H9 — active subscription expiry", () => {
  it("blocks access when active status has expired currentPeriodEnd", () => {
    const expiredEnd = new Date("2020-01-01T00:00:00.000Z");
    const subscription = {
      id: "sub-expired",
      storeId: STORE_ID,
      planId: "plan-starter",
      status: "active" as const,
      currentPeriodStart: new Date("2019-12-01T00:00:00.000Z"),
      currentPeriodEnd: expiredEnd,
      trialEndsAt: null,
      plan: {
        id: "plan-starter",
        name: "Starter",
        slug: "starter",
        monthlyPrice: 0,
        annualPrice: 0,
        maxProducts: 100,
        maxOrders: 100,
        maxTeamMembers: 1,
        aiCreditsPerMonth: 10,
        active: true,
      },
    };

    const access = evaluateSubscriptionAccess(
      subscription,
      new Date("2025-01-01T00:00:00.000Z"),
    );
    expect(access.accessState).toBe("blocked");
    expect(access.reason).toBe("expired_period");

    const live = evaluateSubscriptionAccess(subscription, expiredEnd);
    expect(live.accessState).toBe("allowed");
  });

  it("getSubscriptionAccessState blocks expired active subscriptions in DB", async () => {
    await prisma.subscription.update({
      where: { storeId: STORE_ID },
      data: {
        status: "active",
        currentPeriodEnd: new Date("2020-01-01T00:00:00.000Z"),
        trialEndsAt: null,
      },
    });

    const access = await getSubscriptionAccessState(STORE_ID);
    expect(access.accessState).toBe("blocked");
    expect(access.reason).toBe("expired_period");
  });
});

describe("F.6.14 H11 — order limit durable retry", () => {
  it("classifies limit_exceeded as retriable", () => {
    expect(classifyOrderWebhookSkip("limit_exceeded")).toBe("retriable");
  });
});

describe("F.6.14 H12 — incremental cursor gap", () => {
  it("advances pagination cursor while quarantining skipped orders", async () => {
    const harness = testHarness();
    harness.getStore().ordersSyncCursor = "cursor-page-1";

    harness.mockAdminGraphql
      .mockResolvedValueOnce(
        mockOrdersSyncPageResponse({
          orders: [
            buildOrderNode({
              id: "gid://shopify/Order/1002",
              name: "#1002",
              processedAt: null,
            }),
          ],
          hasNextPage: true,
          endCursor: "cursor-page-2",
        }),
      )
      .mockResolvedValueOnce(
        mockOrdersSyncPageResponse({
          orders: [],
        }),
      );

    const result = await syncOrdersIncremental({
      storeId: STORE_ID,
      shop: SHOP,
      admin: { graphql: harness.mockAdminGraphql },
    });

    expect(result.skipped).toBeGreaterThan(0);
    expect(result.success).toBe(false);

    const syncState = parseOrdersSyncCursorState(
      (await prisma.store.findUnique({ where: { id: STORE_ID } }))?.ordersSyncCursor,
    );
    expect(syncState.quarantinedOrderIds).toContain("gid://shopify/Order/1002");
    expect(syncState.historicalPagesComplete).toBe(true);
  });
});

describe("F.6.14 H13 — post-onboarding order scheduling", () => {
  it("builds deterministic incremental idempotency keys", () => {
    const slot = new Date("2025-06-01T12:34:56.000Z");
    expect(buildOrdersIncrementalIdempotencyKey(STORE_ID, slot)).toMatch(
      /^orders-incremental:store-test-001:\d+$/,
    );
  });

  it("does not schedule before onboarding completes", async () => {
    const result = await scheduleOrdersIncrementalSync(STORE_ID);
    expect(result.scheduled).toBe(false);
    expect(result.reason).toBe("onboarding_incomplete");
  });
});

describe("F.6.14 H14 — cron dependency hardening", () => {
  it("reports queue disabled when CRON_SECRET is missing", () => {
    const health = getCronWorkerHealth({ CRON_SECRET: "" });
    expect(health.queueEnabled).toBe(false);
    expect(health.reason).toBe("CRON_SECRET_missing");
  });

  it("reports queue enabled when CRON_SECRET is configured", () => {
    const health = getCronWorkerHealth({ CRON_SECRET: "secret" });
    expect(health.queueEnabled).toBe(true);
  });
});
