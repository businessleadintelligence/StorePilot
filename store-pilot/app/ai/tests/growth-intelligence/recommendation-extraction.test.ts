import { describe, expect, it } from "vitest";

import { extractGrowthIntelligenceRecommendations } from "../../agents/growth-intelligence.validator";
import { buildValidGrowthIntelligenceDraft, buildGrowthIntelligenceFactsFromSnapshot } from "./helpers";
import { runWithGrowthIntelligenceContext } from "../../agents/agent-execution-context";
import { growthIntelligenceEnrichedSchema } from "../../schemas/growth-intelligence";
import { mutateAndEnrichGrowthIntelligenceOutput } from "../../agents/growth-intelligence-enrichment";
import { getAgentDefinition } from "../../agents/agent-registry";

describe("Growth Intelligence recommendation extraction", () => {
  it("filters implemented recommendations from extraction", async () => {
    const facts = await buildGrowthIntelligenceFactsFromSnapshot();
    const output = buildValidGrowthIntelligenceDraft(facts);

    runWithGrowthIntelligenceContext(
      {
        storeId: "store-1",
        subjectKey: "growth-intelligence:store-1",
        recommendationMemory: {
          implementedIds: new Set(["growth:upsell-campaign"]),
          dismissedIds: new Set(),
          openIds: new Set(),
          snoozedIds: new Set(),
          ignoredIds: new Set(),
        },
      },
      () => {
        const extracted = extractGrowthIntelligenceRecommendations(output);
        expect(extracted.some((item) => item.title.includes("upsell"))).toBe(false);
      },
    );
  });

  it("deprioritizes dismissed recommendations", async () => {
    const facts = await buildGrowthIntelligenceFactsFromSnapshot();
    const output = buildValidGrowthIntelligenceDraft(facts);

    runWithGrowthIntelligenceContext(
      {
        storeId: "store-1",
        subjectKey: "growth-intelligence:store-1",
        recommendationMemory: {
          implementedIds: new Set(),
          dismissedIds: new Set(["growth:retention-winback"]),
          openIds: new Set(),
          snoozedIds: new Set(),
          ignoredIds: new Set(),
        },
      },
      () => {
        const extracted = extractGrowthIntelligenceRecommendations(output);
        const dismissed = extracted.find((item) => item.title.includes("repeat"));
        expect(dismissed?.priority).toBeGreaterThan(2);
      },
    );
  });

  it("enriched schema includes verification and tasks", async () => {
    const facts = await buildGrowthIntelligenceFactsFromSnapshot();
    const enriched = mutateAndEnrichGrowthIntelligenceOutput({
      facts,
      output: buildValidGrowthIntelligenceDraft(facts),
    });

    expect(growthIntelligenceEnrichedSchema.safeParse(enriched).success).toBe(true);
    expect(enriched.recommendations[0]?.tasks.length).toBeGreaterThan(0);
    expect(enriched.recommendations[0]?.verification.expectedWindow).toBeTruthy();
    expect(enriched.recommendations[0]?.estimatedRevenueGain).toBeGreaterThanOrEqual(0);
  });

  it("registers growth intelligence agent with extractRecommendations hook", async () => {
    const definition = getAgentDefinition("growth_intelligence");
    const facts = await buildGrowthIntelligenceFactsFromSnapshot();
    const output = buildValidGrowthIntelligenceDraft(facts);
    const enriched = mutateAndEnrichGrowthIntelligenceOutput({ facts, output });

    expect(definition.extractRecommendations).toBeDefined();

    const extracted = definition.extractRecommendations!({
      agentId: "growth_intelligence",
      subjectKey: "growth-intelligence:store-1",
      output: enriched,
    });

    expect(extracted.length).toBeGreaterThan(0);
    expect(extracted[0]?.category).toBeTruthy();
  });
});

describe("Growth Intelligence score invariants", () => {
  it("preserves growth health score through enrichment", async () => {
    const facts = await buildGrowthIntelligenceFactsFromSnapshot();
    const enriched = mutateAndEnrichGrowthIntelligenceOutput({
      facts,
      output: buildValidGrowthIntelligenceDraft(facts),
    });

    expect(enriched.growthScore).toBe(facts.growthScore);
    expect(enriched.revenueOpportunity).toBe(facts.revenueOpportunity);
    expect(enriched.aovOpportunity).toBe(facts.aovOpportunity);
  });
});
