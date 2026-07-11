import { beforeEach, describe, expect, it, vi } from "vitest";

import { loader } from "../app._index";
import { getOnboardingStatus } from "../../services/onboarding-ui.server";
import { resolveRequestStoreContext } from "../../lib/request-auth.server";

vi.mock("../../lib/request-auth.server", () => ({
  authenticateAdminOnce: vi.fn(),
  getSessionShop: (session: { shop?: string }) => session.shop,
  resolveRequestStoreContext: vi.fn(),
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

const SHOP = "storepilot-test.myshopify.com";
const STORE_ID = "store-test-001";
const STORE_CONTEXT = {
  shop: SHOP,
  storeId: STORE_ID,
  currency: "USD",
  store: { id: STORE_ID, currency: "USD", shopifyDomain: SHOP },
};

function createRequest(): Request {
  return new Request("http://localhost/app");
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("F.4.5 Dashboard Onboarding Loader", () => {
  it("1. returns null onboarding when shop session is missing", async () => {
    vi.mocked(resolveRequestStoreContext).mockResolvedValue(null);

    const data = await loader({
      request: createRequest(),
    } as Parameters<typeof loader>[0]);

    expect(data.onboarding).toBeNull();
    expect(data.syncStatus).toBeNull();
    expect(data.metrics).toBeNull();
    expect(data.healthScore).toBeNull();
    expect(data.executiveBrief).toBeNull();
    expect(getOnboardingStatus).not.toHaveBeenCalled();
  });

  it("2. returns null onboarding when store is missing", async () => {
    vi.mocked(resolveRequestStoreContext).mockResolvedValue(null);

    const data = await loader({
      request: createRequest(),
    } as Parameters<typeof loader>[0]);

    expect(data.onboarding).toBeNull();
    expect(data.syncStatus).toBeNull();
    expect(data.metrics).toBeNull();
    expect(data.healthScore).toBeNull();
    expect(data.executiveBrief).toBeNull();
    expect(getOnboardingStatus).not.toHaveBeenCalled();
  });

  it("3. loads serialized onboarding for active store", async () => {
    vi.mocked(resolveRequestStoreContext).mockResolvedValue(STORE_CONTEXT);
    vi.mocked(getOnboardingStatus).mockResolvedValue({
      status: "running",
      progressPercent: 66,
      progressLabel: "Syncing inventory",
      productSyncStatus: "completed",
      inventorySyncStatus: "running",
      ordersSyncStatus: "not_started",
      blockedReason: null,
      blockedMessage: null,
      currentJobId: "job-inventory-1",
      startedAt: new Date("2026-06-01T10:00:00.000Z"),
      completedAt: null,
    });

    const data = await loader({
      request: createRequest(),
    } as Parameters<typeof loader>[0]);

    expect(getOnboardingStatus).toHaveBeenCalledWith(STORE_ID);
    expect(data.onboarding).toEqual({
      status: "running",
      progressPercent: 66,
      progressLabel: "Syncing inventory",
      productSyncStatus: "completed",
      inventorySyncStatus: "running",
      ordersSyncStatus: "not_started",
      ordersBlockedDisplay: null,
      startedAt: "2026-06-01T10:00:00.000Z",
      completedAt: null,
    });
  });

  it("4. does not expose internal onboarding fields beyond loader contract", async () => {
    vi.mocked(resolveRequestStoreContext).mockResolvedValue(STORE_CONTEXT);
    vi.mocked(getOnboardingStatus).mockResolvedValue({
      status: "running",
      progressPercent: 90,
      progressLabel: "Syncing orders blocked",
      productSyncStatus: "completed",
      inventorySyncStatus: "completed",
      ordersSyncStatus: "blocked",
      blockedReason: "access_denied",
      blockedMessage: "Waiting for Shopify order access approval",
      currentJobId: null,
      startedAt: new Date("2026-06-01T10:00:00.000Z"),
      completedAt: null,
    });

    const data = await loader({
      request: createRequest(),
    } as Parameters<typeof loader>[0]);

    expect(data.onboarding).not.toHaveProperty("lastErrorMessage");
    expect(data.onboarding).not.toHaveProperty("lastErrorCode");
    expect(data.onboarding).not.toHaveProperty("onboardingRunId");
    expect(data.onboarding).not.toHaveProperty("blockedReason");
    expect(data.onboarding).not.toHaveProperty("blockedMessage");
    expect(data.onboarding).not.toHaveProperty("currentJobId");
    expect(data.onboarding?.ordersBlockedDisplay).toMatchObject({
      heading: "Orders Sync Waiting",
      primary: "Waiting for Shopify order access approval",
    });
  });
});
