import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildBundleDiscoveryWidget } from "../command-center.server";
import { mutateAndEnrichBundleDiscoveryOutput } from "../../ai/agents/bundle-discovery-enrichment";
import {
  buildBundleFactsFromSnapshot,
  buildValidBundleDiscoveryDraft,
} from "../../ai/tests/bundle-discovery/helpers";

vi.mock("../../db.server", () => ({
  default: {
    aiAgentResult: {
      findFirst: vi.fn(),
    },
    aiAgentRun: {
      count: vi.fn(),
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Command center bundle aggregation", () => {
  it("enriches bundle metrics used by executive dashboards", () => {
    const facts = buildBundleFactsFromSnapshot();
    const output = buildValidBundleDiscoveryDraft(facts);
    const enriched = mutateAndEnrichBundleDiscoveryOutput({ facts, output });

    expect(enriched.potentialAttachRate).toBe(facts.potentialAttachRate);
    expect(enriched.potentialInventoryReduction).toBe(facts.potentialInventoryReduction);
    expect(enriched.bundleHealthScore).toBe(facts.bundleHealthScore);
  });

  it("builds bundle discovery widget fields from recommendations", async () => {
    const prisma = (await import("../../db.server")).default;
    vi.mocked(prisma.aiAgentResult.findFirst).mockResolvedValue({
      resultJson: {
        bundleHealthScore: 82,
        potentialInventoryReduction: 12,
        potentialAttachRate: 0.41,
        bundleCandidates: [{ id: "bundle:a:b" }, { id: "bundle:c:d" }],
      },
    } as never);
    vi.mocked(prisma.aiAgentRun.count).mockResolvedValue(2);

    const widget = await buildBundleDiscoveryWidget("store-1", [
      {
        stableId: "stable-1",
        id: "bundle:product-1:product-2",
        subjectKey: "bundle:store-1",
        productId: null,
        productTitle: null,
        title: "Launch starter kit",
        reason: "Strong co-purchase signal",
        category: "Starter Kit",
        group: "Operational Improvements",
        priority: 1,
        priorityScore: 90,
        confidence: 0.9,
        difficulty: "Easy",
        evidence: ["Attach rate: 0.83"],
        estimatedImpact: {
          revenueRecovered: null,
          revenueOpportunity: null,
          ordersProtected: null,
          inventoryDaysSaved: null,
          inventoryCostSaved: null,
          estimatedLostSales: null,
          marginImprovement: null,
        },
        merchantAction: ["Create starter kit"],
        tasks: ["Create starter kit"],
        timeline: { created: "2026-06-20T08:00:00.000Z" },
        status: "open",
        verification: {},
        expectedResult: "Increase attach rate",
        potentialRisk: "Margin compression",
        estimatedTime: "2 weeks",
        businessImpact: "Capture co-purchase behavior",
        lastSeenAt: "2026-06-20T08:00:00.000Z",
        updatedAt: "2026-06-20T08:00:00.000Z",
      },
    ]);

    expect(widget.bundleHealth).toBe(82);
    expect(widget.openRecommendations).toBe(1);
    expect(widget.topOpportunities).toBe(2);
    expect(widget.potentialInventoryReduction).toBe(12);
    expect(widget.potentialAttachRate).toBe(0.41);
    expect(widget.recentExecutions).toBe(2);
    expect(widget.recommendationGroups).toEqual([
      { label: "Operational Improvements", value: 1 },
    ]);
  });

  it("returns zeroed bundle widget defaults when no persisted agent results exist", async () => {
    const prisma = (await import("../../db.server")).default;
    vi.mocked(prisma.aiAgentResult.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.aiAgentRun.count).mockResolvedValue(0);

    const widget = await buildBundleDiscoveryWidget("store-1", []);

    expect(widget.bundleHealth).toBe(0);
    expect(widget.openRecommendations).toBe(0);
    expect(widget.recentExecutions).toBe(0);
  });
});
