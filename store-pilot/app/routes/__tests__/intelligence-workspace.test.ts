import { beforeEach, describe, expect, it, vi } from "vitest";

import { loader } from "../app.executive";
import { authenticate } from "../../shopify.server";
import { getExecutiveDashboardForUi } from "../../services/executive-ui.server";

vi.mock("../../shopify.server", () => ({
  authenticate: {
    admin: vi.fn(),
  },
}));

vi.mock("../../db.server", () => ({
  default: {
    store: {
      findUnique: vi.fn(async () => ({ id: "store-1", currency: "USD" })),
    },
    executiveDecision: { findMany: vi.fn(async () => []) },
    decisionTask: { findMany: vi.fn(async () => []) },
    businessStability: { findUnique: vi.fn(async () => null) },
    historicalMemory: { findUnique: vi.fn(async () => null) },
    decisionJournal: { count: vi.fn(async () => 0), findMany: vi.fn(async () => []) },
    merchantBehaviorProfile: { findUnique: vi.fn(async () => null) },
    personalizationProfile: { findUnique: vi.fn(async () => null) },
    adaptiveScore: { findUnique: vi.fn(async () => null) },
    learningReadiness: { findUnique: vi.fn(async () => null) },
    merchantTimeline: { findMany: vi.fn(async () => []) },
    causalTimeline: { findMany: vi.fn(async () => []) },
    product: { findMany: vi.fn(async () => []) },
    prediction: { findMany: vi.fn(async () => []) },
    experiment: { findMany: vi.fn(async () => []) },
    rootCause: { findMany: vi.fn(async () => []) },
    knowledgeGraphSearchIndex: { findMany: vi.fn(async () => []) },
    knowledgeGraphNode: { findMany: vi.fn(async () => []) },
    businessDnaVersion: { findFirst: vi.fn(async () => null) },
  },
}));

vi.mock("../../services/executive-ui.server", () => ({
  getExecutiveDashboardForUi: vi.fn(),
}));

vi.mock("../../executive/api/executive-api", () => ({
  getExecutiveDecisions: vi.fn(async () => []),
  getOperationsQueue: vi.fn(async () => []),
}));

vi.mock("../../prediction/api/prediction-api", () => ({
  getBusinessStability: vi.fn(async () => ({ score: 72 })),
}));

vi.mock("../../services/merchant-intelligence-ui.server", () => ({
  getMerchantIntelligenceDashboardForUi: vi.fn(async () => ({
    adaptiveScore: 55,
    decisionJournalCount: 3,
    learningStage: "learning",
    dnaVersion: 2,
    behaviorProfile: null,
    personalization: null,
    recentTimeline: [],
  })),
}));

vi.mock("../../learning/historical/api/historical-api", () => ({
  getHistoricalMemory: vi.fn(async () => null),
}));

vi.mock("../../knowledge/graph/api/graph-api", () => ({
  createKnowledgeGraphApi: vi.fn(() => ({
    search: vi.fn(async () => []),
    getStatistics: vi.fn(async () => ({ totalNodes: 0, totalEdges: 0 })),
  })),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(authenticate.admin).mockResolvedValue({
    session: { shop: "storepilot-test.myshopify.com" },
  } as never);
});

describe("Executive intelligence workspace loader", () => {
  it("returns executive workspace payload for authenticated store", async () => {
    vi.mocked(getExecutiveDashboardForUi).mockResolvedValue({
      briefing: null,
      operatingPlan: null,
      decisionCards: [],
      operationalReadinessScore: 80,
      executiveCooReady: true,
      currency: "USD",
    });

    const result = await loader({
      request: new Request("http://localhost/app/executive.data"),
      params: {},
      context: {},
      url: new URL("http://localhost/app/executive"),
      pattern: "/app/executive",
    } as never);

    expect(result.workspace).toMatchObject({
      kind: "executive",
      stabilityScore: 72,
    });
    expect(result.currency).toBe("USD");
  });

  it("streams workspace on document SSR instead of empty shell revalidate", async () => {
    vi.mocked(getExecutiveDashboardForUi).mockResolvedValue({
      briefing: null,
      operatingPlan: null,
      decisionCards: [],
      operationalReadinessScore: 80,
      executiveCooReady: true,
      currency: "USD",
    });

    const result = await loader({
      request: new Request("http://localhost/app/executive"),
      params: {},
      context: {},
      url: new URL("http://localhost/app/executive"),
      pattern: "/app/executive",
    } as never);

    expect(result.deferWorkspaceLoad).toBeUndefined();
    expect(result.workspace).toBeInstanceOf(Promise);
    const workspace = await result.workspace;
    expect(workspace).toMatchObject({
      kind: "executive",
      stabilityScore: 72,
    });
  });
});
