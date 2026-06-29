import { beforeEach, describe, expect, it, vi } from "vitest";

import { loader } from "../app._index";
import { getOnboardingStatus } from "../../services/onboarding-ui.server";
import { getStoreMetrics } from "../../services/metrics.server";
import { getStoreSyncStatus } from "../../services/sync-status.server";
import { authenticate } from "../../shopify.server";

vi.mock("../../shopify.server", () => ({
  authenticate: {
    admin: vi.fn(),
  },
}));

vi.mock("../../onboarding/onboarding-service", () => ({
  getOnboardingReminders: vi.fn(async () => []),
  serializeMerchantOnboardingRemindersForLoader: (reminders: unknown) => reminders,
}));

vi.mock("../../onboarding/onboarding-service", () => ({
  getOnboardingReminders: vi.fn(async () => []),
  serializeMerchantOnboardingRemindersForLoader: (reminders: unknown) => reminders,
}));

vi.mock("../../services/onboarding-ui.server", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../services/onboarding-ui.server")>();
  return {
    ...actual,
    getOnboardingStatus: vi.fn(),
  };
});

vi.mock("../../services/sync-status.server", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../services/sync-status.server")>();
  return {
    ...actual,
    getStoreSyncStatus: vi.fn(),
  };
});

vi.mock("../../services/metrics.server", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../services/metrics.server")>();
  return {
    ...actual,
    getStoreMetrics: vi.fn(),
  };
});

const SHOP = "storepilot-test.myshopify.com";

function createRequest(): Request {
  return new Request("http://localhost/app");
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("F.4.9 Dashboard Executive Brief Loader", () => {
  it("1. returns null executive brief when store is missing", async () => {
    vi.mocked(authenticate.admin).mockResolvedValue({
      session: { shop: "missing-shop.myshopify.com" },
    } as unknown as Awaited<ReturnType<typeof authenticate.admin>>);

    const data = await loader({
      request: createRequest(),
    } as Parameters<typeof loader>[0]);

    expect(data.executiveBrief).toBeNull();
  });

  it("2. derives executive brief from metrics, sync status, and health score", async () => {
    vi.mocked(authenticate.admin).mockResolvedValue({
      session: { shop: SHOP },
    } as unknown as Awaited<ReturnType<typeof authenticate.admin>>);
    vi.mocked(getOnboardingStatus).mockResolvedValue(null);
    vi.mocked(getStoreSyncStatus).mockResolvedValue({
      onboardingStatus: "running",
      products: { synced: true, count: 27, lastSyncAt: null },
      inventory: { synced: true, count: 27, lastSyncAt: null },
      orders: {
        synced: false,
        count: 0,
        lastSyncAt: null,
        blocked: true,
        blockedReason: "order_access_pending",
      },
    });
    vi.mocked(getStoreMetrics).mockResolvedValue({
      products: 27,
      activeProducts: 27,
      orders: 173,
      grossRevenue: 12450,
      averageOrderValue: 71.96,
      lowStockProducts: 3,
      outOfStockProducts: 1,
      inventoryUnits: 540,
    });

    const data = await loader({
      request: createRequest(),
    } as Parameters<typeof loader>[0]);

    expect(data.executiveBrief?.headline).toBe(
      "Store operations require attention",
    );
    expect(data.executiveBrief?.highlights).toEqual([
      "27 products synced",
      "173 orders imported",
      "$12,450 revenue recorded",
    ]);
    expect(data.executiveBrief?.concerns).toEqual([
      "3 products are low stock",
      "1 product is out of stock",
      "Orders sync is waiting for Shopify approval",
    ]);
    expect(JSON.stringify(data.executiveBrief)).not.toContain("GraphQL");
  });
});
