import { describe, expect, it } from "vitest";
import { extractTrendIntelligenceRecommendations } from "../../agents/trend-intelligence.validator";
import { buildValidTrendIntelligenceDraft, buildTrendFactsFromSnapshot } from "./helpers";
import { runWithTrendIntelligenceContext } from "../../agents/agent-execution-context";
import { trendIntelligenceEnrichedSchema } from "../../schemas/trend-intelligence";
import { mutateAndEnrichTrendIntelligenceOutput } from "../../agents/trend-intelligence-enrichment";
import { getAgentDefinition } from "../../agents/agent-registry";

describe("Trend Intelligence recommendation extraction", () => {
  it("filters implemented recommendations from extraction", () => {
    const facts = buildTrendFactsFromSnapshot();
    const output = buildValidTrendIntelligenceDraft(facts);
    const implemented = output.recommendations[0];
    expect(implemented).toBeDefined();

    runWithTrendIntelligenceContext(
      {
        storeId: "store-1",
        subjectKey: "trend:store-1",
        recommendationMemory: {
          implementedIds: new Set([implemented!.id]),
          dismissedIds: new Set(),
          openIds: new Set(),
          snoozedIds: new Set(),
          ignoredIds: new Set(),
        },
      },
      () => {
        const extracted = extractTrendIntelligenceRecommendations(output);
        expect(extracted.some((item) => item.title === implemented!.title)).toBe(false);
      },
    );
  });

  it("deprioritizes dismissed recommendations", () => {
    const facts = buildTrendFactsFromSnapshot();
    const output = buildValidTrendIntelligenceDraft(facts);
    const dismissedRecommendation =
      output.recommendations.find((recommendation) => recommendation.category === "Declining Demand") ??
      output.recommendations[0];
    expect(dismissedRecommendation).toBeDefined();

    runWithTrendIntelligenceContext(
      {
        storeId: "store-1",
        subjectKey: "trend:store-1",
        recommendationMemory: {
          implementedIds: new Set(),
          dismissedIds: new Set([dismissedRecommendation!.id]),
          openIds: new Set(),
          snoozedIds: new Set(),
          ignoredIds: new Set(),
        },
      },
      () => {
        const extracted = extractTrendIntelligenceRecommendations(output);
        const dismissed = extracted.find((item) => item.title === dismissedRecommendation!.title);
        expect(dismissed?.priority).toBeGreaterThan(2);
      },
    );
  });

  it("enriched schema includes verification and tasks", () => {
    const facts = buildTrendFactsFromSnapshot();
    const enriched = mutateAndEnrichTrendIntelligenceOutput({
      facts,
      output: buildValidTrendIntelligenceDraft(facts),
    });

    expect(trendIntelligenceEnrichedSchema.safeParse(enriched).success).toBe(true);
    expect(enriched.recommendations[0]?.tasks.length).toBeGreaterThan(0);
    expect(enriched.recommendations[0]?.verification.expectedWindow).toBeTruthy();
  });

  it("registers trend intelligence agent with extractRecommendations hook", () => {
    const definition = getAgentDefinition("trend_intelligence");
    const facts = buildTrendFactsFromSnapshot();
    const output = buildValidTrendIntelligenceDraft(facts);
    const enriched = mutateAndEnrichTrendIntelligenceOutput({ facts, output });

    expect(definition.extractRecommendations).toBeDefined();

    const extracted = definition.extractRecommendations!({
      agentId: "trend_intelligence",
      subjectKey: "trend:store-1",
      output: enriched,
    });

    expect(extracted.length).toBeGreaterThan(0);
    expect(extracted[0]?.category).toBeTruthy();
  });
});

describe("Trend Intelligence score invariants", () => {
  it("preserves trend scores through enrichment", () => {
    const facts = buildTrendFactsFromSnapshot();
    const enriched = mutateAndEnrichTrendIntelligenceOutput({
      facts,
      output: buildValidTrendIntelligenceDraft(facts),
    });

    expect(enriched.trendHealthScore).toBe(facts.trendHealthScore);
    expect(enriched.trendDirection).toBe(facts.trendDirection);
  });
});
