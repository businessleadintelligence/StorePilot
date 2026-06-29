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

describe("F.5.1 Dashboard Recommendations Loader", () => {
  it("1. returns null recommendations when store is missing", async () => {
    vi.mocked(authenticate.admin).mockResolvedValue({
      session: { shop: "missing-shop.myshopify.com" },
    } as unknown as Awaited<ReturnType<typeof authenticate.admin>>);

    const data = await loader({
      request: createRequest(),
    } as Parameters<typeof loader>[0]);

    expect(data.recommendations).toBeNull();
  });

  it("2. derives recommendations from metrics and onboarding without internal messages", async () => {
    vi.mocked(authenticate.admin).mockResolvedValue({
      session: { shop: SHOP },
    } as unknown as Awaited<ReturnType<typeof authenticate.admin>>);
    vi.mocked(getOnboardingStatus).mockResolvedValue({
      status: "completed",
      progressPercent: 100,
      progressLabel: "Complete",
      productSyncStatus: "completed",
      inventorySyncStatus: "completed",
      ordersSyncStatus: "completed",
      blockedReason: null,
      blockedMessage: null,
      currentJobId: null,
      startedAt: new Date("2026-01-01T00:00:00Z"),
      completedAt: new Date("2026-01-02T00:00:00Z"),
    });
    vi.mocked(getStoreSyncStatus).mockResolvedValue({
      onboardingStatus: "completed",
      products: { synced: true, count: 27, lastSyncAt: null },
      inventory: { synced: true, count: 27, lastSyncAt: null },
      orders: {
        synced: true,
        count: 173,
        lastSyncAt: null,
        blocked: false,
        blockedReason: null,
      },
    });
    vi.mocked(getStoreMetrics).mockResolvedValue({
      products: 27,
      activeProducts: 27,
      orders: 0,
      grossRevenue: 0,
      averageOrderValue: 0,
      lowStockProducts: 2,
      outOfStockProducts: 1,
      inventoryUnits: 540,
    });

    const data = await loader({
      request: createRequest(),
    } as Parameters<typeof loader>[0]);

    expect(data.recommendations?.critical).toBe(1);
    expect(data.recommendations?.warning).toBeGreaterThan(0);
    expect(data.recommendations?.recommendations[0]?.severity).toBe("critical");
    expect(data.recommendations?.recommendations.map((item) => item.id)).toEqual([
      "inventory-out-of-stock",
      "inventory-low-stock",
      "orders-not-imported",
      "health-below-target",
    ]);
    expect(JSON.stringify(data.recommendations)).not.toMatch(/graphql/i);
    expect(JSON.stringify(data.recommendations)).not.toMatch(/worker/i);
  });

  it("3. returns empty recommendations for healthy store operations", async () => {
    vi.mocked(authenticate.admin).mockResolvedValue({
      session: { shop: SHOP },
    } as unknown as Awaited<ReturnType<typeof authenticate.admin>>);
    vi.mocked(getOnboardingStatus).mockResolvedValue({
      status: "completed",
      progressPercent: 100,
      progressLabel: "Complete",
      productSyncStatus: "completed",
      inventorySyncStatus: "completed",
      ordersSyncStatus: "completed",
      blockedReason: null,
      blockedMessage: null,
      currentJobId: null,
      startedAt: new Date("2026-01-01T00:00:00Z"),
      completedAt: new Date("2026-01-02T00:00:00Z"),
    });
    vi.mocked(getStoreSyncStatus).mockResolvedValue({
      onboardingStatus: "completed",
      products: { synced: true, count: 27, lastSyncAt: null },
      inventory: { synced: true, count: 27, lastSyncAt: null },
      orders: {
        synced: true,
        count: 173,
        lastSyncAt: null,
        blocked: false,
        blockedReason: null,
      },
    });
    vi.mocked(getStoreMetrics).mockResolvedValue({
      products: 27,
      activeProducts: 27,
      orders: 173,
      grossRevenue: 12450,
      averageOrderValue: 71.96,
      lowStockProducts: 0,
      outOfStockProducts: 0,
      inventoryUnits: 540,
    });

    const data = await loader({
      request: createRequest(),
    } as Parameters<typeof loader>[0]);

    expect(data.recommendations).toEqual({
      recommendations: [],
      critical: 0,
      warning: 0,
      info: 0,
    });
  });
});
