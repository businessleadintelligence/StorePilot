import { beforeEach, describe, expect, it, vi } from "vitest";

import { loader } from "../app._index";
import { getOnboardingStatus } from "../../services/onboarding-ui.server";
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

const SHOP = "storepilot-test.myshopify.com";
const STORE_ID = "store-test-001";

function createRequest(): Request {
  return new Request("http://localhost/app");
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("F.4.6 Dashboard Sync Status Loader", () => {
  it("1. returns null sync status when store is missing", async () => {
    vi.mocked(authenticate.admin).mockResolvedValue({
      session: { shop: "missing-shop.myshopify.com" },
    } as unknown as Awaited<ReturnType<typeof authenticate.admin>>);

    const data = await loader({
      request: createRequest(),
    } as Parameters<typeof loader>[0]);

    expect(data.syncStatus).toBeNull();
    expect(data.metrics).toBeNull();
    expect(data.healthScore).toBeNull();
    expect(data.executiveBrief).toBeNull();
    expect(getStoreSyncStatus).not.toHaveBeenCalled();
  });

  it("2. loads sync status alongside onboarding", async () => {
    vi.mocked(authenticate.admin).mockResolvedValue({
      session: { shop: SHOP },
    } as unknown as Awaited<ReturnType<typeof authenticate.admin>>);
    vi.mocked(getOnboardingStatus).mockResolvedValue({
      status: "running",
      progressPercent: 85,
      progressLabel: "Syncing orders",
      productSyncStatus: "completed",
      inventorySyncStatus: "completed",
      ordersSyncStatus: "blocked",
      blockedReason: "access_denied",
      blockedMessage: "GraphQL error: Access denied for orders field",
      currentJobId: null,
      startedAt: new Date("2026-06-21T08:00:00.000Z"),
      completedAt: null,
    });
    vi.mocked(getStoreSyncStatus).mockResolvedValue({
      onboardingStatus: "running",
      products: {
        synced: true,
        count: 27,
        lastSyncAt: "2026-06-21T10:51:00.000Z",
      },
      inventory: {
        synced: true,
        count: 27,
        lastSyncAt: "2026-06-21T12:02:00.000Z",
      },
      orders: {
        synced: false,
        count: 0,
        lastSyncAt: null,
        blocked: true,
        blockedReason: "order_access_pending",
      },
    });

    const data = await loader({
      request: createRequest(),
    } as Parameters<typeof loader>[0]);

    expect(getStoreSyncStatus).toHaveBeenCalledWith(STORE_ID);
    expect(data.syncStatus).toEqual({
      onboardingStatus: "running",
      products: {
        synced: true,
        count: 27,
        lastSyncAt: "2026-06-21T10:51:00.000Z",
      },
      inventory: {
        synced: true,
        count: 27,
        lastSyncAt: "2026-06-21T12:02:00.000Z",
      },
      orders: {
        synced: false,
        count: 0,
        lastSyncAt: null,
        blocked: true,
        blockedReason: "order_access_pending",
      },
    });
    expect(data.syncStatus).not.toHaveProperty("blockedMessage");
    expect(data.syncStatus?.orders.blockedReason).not.toBe("access_denied");
  });
});
