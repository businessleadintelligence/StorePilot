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
const STORE_ID = "store-test-001";

function createRequest(): Request {
  return new Request("http://localhost/app");
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("F.4.7 Dashboard Metrics Loader", () => {
  it("1. returns null metrics when store is missing", async () => {
    vi.mocked(authenticate.admin).mockResolvedValue({
      session: { shop: "missing-shop.myshopify.com" },
    } as unknown as Awaited<ReturnType<typeof authenticate.admin>>);

    const data = await loader({
      request: createRequest(),
    } as Parameters<typeof loader>[0]);

    expect(data.metrics).toBeNull();
    expect(data.healthScore).toBeNull();
    expect(data.executiveBrief).toBeNull();
    expect(getStoreMetrics).not.toHaveBeenCalled();
  });

  it("2. loads serialized metrics for active store", async () => {
    vi.mocked(authenticate.admin).mockResolvedValue({
      session: { shop: SHOP },
    } as unknown as Awaited<ReturnType<typeof authenticate.admin>>);
    vi.mocked(getOnboardingStatus).mockResolvedValue(null);
    vi.mocked(getStoreSyncStatus).mockResolvedValue({
      onboardingStatus: null,
      products: { synced: false, count: 0, lastSyncAt: null },
      inventory: { synced: false, count: 0, lastSyncAt: null },
      orders: {
        synced: false,
        count: 0,
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
      averageOrderValue: 71.965,
      lowStockProducts: 3,
      outOfStockProducts: 1,
      inventoryUnits: 540,
    });

    const data = await loader({
      request: createRequest(),
    } as Parameters<typeof loader>[0]);

    expect(getStoreMetrics).toHaveBeenCalledWith(STORE_ID);
    expect(data.metrics).toEqual({
      products: 27,
      activeProducts: 27,
      orders: 173,
      grossRevenue: 12450,
      averageOrderValue: 71.965,
      lowStockProducts: 3,
      outOfStockProducts: 1,
      inventoryUnits: 540,
    });
    expect(data.currency).toBe("USD");
    expect(Object.values(data.metrics ?? {}).every((value) => value !== null)).toBe(
      true,
    );
  });
});
