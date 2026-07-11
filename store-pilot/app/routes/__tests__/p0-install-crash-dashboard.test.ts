import { beforeEach, describe, expect, it, vi } from "vitest";

import { loader } from "../app._index";
import { getOnboardingStatus } from "../../services/onboarding-ui.server";
import { resolveRequestStoreContext } from "../../lib/request-auth.server";
import { getLearningBootstrapForUi } from "../../services/learning-ui.server";
import { getQuickWinsForDashboard } from "../../services/quick-wins-ui.server";
import { getExecutiveDashboardForUi } from "../../services/executive-ui.server";
import { getRootCauseDashboardForUi } from "../../services/root-cause-ui.server";
import { getPredictionDashboardForUi } from "../../services/prediction-ui.server";
import { getExperimentDashboardForUi } from "../../services/experiment-ui.server";
import { getMerchantIntelligenceDashboardForUi } from "../../services/merchant-intelligence-ui.server";

vi.mock("../../lib/request-auth.server", () => ({
  authenticateAdminOnce: vi.fn(),
  getSessionShop: (session: { shop?: string }) => session.shop,
  resolveRequestStoreContext: vi.fn(),
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

vi.mock("../../services/learning-ui.server", () => ({
  getLearningBootstrapForUi: vi.fn(async () => null),
}));

vi.mock("../../services/quick-wins-ui.server", () => ({
  getQuickWinsForDashboard: vi.fn(async () => null),
}));

vi.mock("../../services/executive-ui.server", () => ({
  getExecutiveDashboardForUi: vi.fn(async () => null),
}));

vi.mock("../../services/root-cause-ui.server", () => ({
  getRootCauseDashboardForUi: vi.fn(async () => null),
}));

vi.mock("../../services/prediction-ui.server", () => ({
  getPredictionDashboardForUi: vi.fn(async () => null),
}));

vi.mock("../../services/experiment-ui.server", () => ({
  getExperimentDashboardForUi: vi.fn(async () => null),
}));

vi.mock("../../services/merchant-intelligence-ui.server", () => ({
  getMerchantIntelligenceDashboardForUi: vi.fn(async () => null),
}));

const SHOP = "storepilot-test.myshopify.com";
const STORE_ID = "store-test-001";
const STORE_CONTEXT = {
  shop: SHOP,
  storeId: STORE_ID,
  currency: "USD",
  store: { id: STORE_ID, currency: "USD", shopifyDomain: SHOP },
};

function mockActiveStoreContext() {
  vi.mocked(resolveRequestStoreContext).mockResolvedValue(STORE_CONTEXT);
}

function createRequest(path = "http://localhost/app"): Request {
  return new Request(path);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("P0 install crash — dashboard intelligence SSR guard", () => {
  it("does not invoke intelligence loaders on document SSR requests", async () => {
    mockActiveStoreContext();
    vi.mocked(getOnboardingStatus).mockResolvedValue({
      status: "running",
      progressPercent: 10,
      progressLabel: "Starting setup",
      productSyncStatus: "not_started",
      inventorySyncStatus: "not_started",
      ordersSyncStatus: "not_started",
      blockedReason: null,
      blockedMessage: null,
      currentJobId: null,
      startedAt: new Date("2026-07-10T17:00:00.000Z"),
      completedAt: null,
    });

    const data = await loader({
      request: createRequest("http://localhost/app"),
    } as Parameters<typeof loader>[0]);

    expect(data.deferIntelligenceLoad).toBe(true);
    expect(data.learningBootstrap).toBeNull();
    expect(getLearningBootstrapForUi).not.toHaveBeenCalled();
    expect(getQuickWinsForDashboard).not.toHaveBeenCalled();
    expect(getExecutiveDashboardForUi).not.toHaveBeenCalled();
    expect(getRootCauseDashboardForUi).not.toHaveBeenCalled();
    expect(getPredictionDashboardForUi).not.toHaveBeenCalled();
    expect(getExperimentDashboardForUi).not.toHaveBeenCalled();
    expect(getMerchantIntelligenceDashboardForUi).not.toHaveBeenCalled();
  });

  it("loads intelligence sections on React Router data requests", async () => {
    mockActiveStoreContext();
    vi.mocked(getOnboardingStatus).mockResolvedValue({
      status: "running",
      progressPercent: 10,
      progressLabel: "Starting setup",
      productSyncStatus: "not_started",
      inventorySyncStatus: "not_started",
      ordersSyncStatus: "not_started",
      blockedReason: null,
      blockedMessage: null,
      currentJobId: null,
      startedAt: new Date("2026-07-10T17:00:00.000Z"),
      completedAt: null,
    });

    const data = await loader({
      request: createRequest("http://localhost/app.data"),
    } as Parameters<typeof loader>[0]);

    expect(data.deferIntelligenceLoad).toBe(false);
    expect(getLearningBootstrapForUi).toHaveBeenCalledWith(STORE_ID, {
      products: "not_started",
      inventory: "not_started",
      orders: "not_started",
    });
    expect(getQuickWinsForDashboard).toHaveBeenCalledWith(STORE_ID, "USD");
    expect(getExecutiveDashboardForUi).toHaveBeenCalledWith(STORE_ID, "USD");
    expect(getRootCauseDashboardForUi).toHaveBeenCalledWith(STORE_ID);
    expect(getPredictionDashboardForUi).toHaveBeenCalledWith(STORE_ID);
    expect(getExperimentDashboardForUi).toHaveBeenCalledWith(STORE_ID);
    expect(getMerchantIntelligenceDashboardForUi).toHaveBeenCalledWith(
      STORE_ID,
    );
  });
});
