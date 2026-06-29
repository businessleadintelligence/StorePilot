import { describe, expect, it } from "vitest";

import { extractPricingIntelligenceRecommendations } from "../../agents/pricing-intelligence.validator";
import { buildValidPricingIntelligenceDraft, buildPricingIntelligenceFactsFromSnapshot } from "./helpers";
import { runWithPricingIntelligenceContext } from "../../agents/agent-execution-context";
import { pricingIntelligenceEnrichedSchema } from "../../schemas/pricing-intelligence";
import { mutateAndEnrichPricingIntelligenceOutput } from "../../agents/pricing-intelligence-enrichment";
import { getAgentDefinition } from "../../agents/agent-registry";

describe("Pricing Intelligence recommendation extraction", () => {
  it("filters implemented recommendations from extraction", async () => {
    const facts = await buildPricingIntelligenceFactsFromSnapshot();
    const output = buildValidPricingIntelligenceDraft(facts);

    runWithPricingIntelligenceContext(
      {
        storeId: "store-1",
        subjectKey: "pricing-intelligence:store-1",
        recommendationMemory: {
          implementedIds: new Set(["pricing:discount-discipline"]),
          dismissedIds: new Set(),
          openIds: new Set(),
          snoozedIds: new Set(),
          ignoredIds: new Set(),
        },
      },
      () => {
        const extracted = extractPricingIntelligenceRecommendations(output);
        expect(extracted.some((item) => item.title.includes("discount"))).toBe(false);
      },
    );
  });

  it("deprioritizes dismissed recommendations", async () => {
    const facts = await buildPricingIntelligenceFactsFromSnapshot();
    const output = buildValidPricingIntelligenceDraft(facts);

    runWithPricingIntelligenceContext(
      {
        storeId: "store-1",
        subjectKey: "pricing-intelligence:store-1",
        recommendationMemory: {
          implementedIds: new Set(),
          dismissedIds: new Set(["pricing:premium-raise"]),
          openIds: new Set(),
          snoozedIds: new Set(),
          ignoredIds: new Set(),
        },
      },
      () => {
        const extracted = extractPricingIntelligenceRecommendations(output);
        const dismissed = extracted.find((item) => item.title.includes("premium"));
        expect(dismissed?.priority).toBeGreaterThan(2);
      },
    );
  });

  it("enriched schema includes verification and tasks", async () => {
    const facts = await buildPricingIntelligenceFactsFromSnapshot();
    const enriched = mutateAndEnrichPricingIntelligenceOutput({
      facts,
      output: buildValidPricingIntelligenceDraft(facts),
    });

    expect(pricingIntelligenceEnrichedSchema.safeParse(enriched).success).toBe(true);
    expect(enriched.recommendations[0]?.tasks.length).toBeGreaterThan(0);
    expect(enriched.recommendations[0]?.verification.expectedWindow).toBeTruthy();
    expect(enriched.recommendations[0]?.estimatedRevenueGain).toBeGreaterThanOrEqual(0);
  });

  it("registers pricing intelligence agent with extractRecommendations hook", async () => {
    const definition = getAgentDefinition("pricing_intelligence");
    const facts = await buildPricingIntelligenceFactsFromSnapshot();
    const output = buildValidPricingIntelligenceDraft(facts);
    const enriched = mutateAndEnrichPricingIntelligenceOutput({ facts, output });

    expect(definition.extractRecommendations).toBeDefined();

    const extracted = definition.extractRecommendations!({
      agentId: "pricing_intelligence",
      subjectKey: "pricing-intelligence:store-1",
      output: enriched,
    });

    expect(extracted.length).toBeGreaterThan(0);
    expect(extracted[0]?.category).toBeTruthy();
  });
});

describe("Pricing Intelligence score invariants", () => {
  it("preserves pricing health score through enrichment", async () => {
    const facts = await buildPricingIntelligenceFactsFromSnapshot();
    const enriched = mutateAndEnrichPricingIntelligenceOutput({
      facts,
      output: buildValidPricingIntelligenceDraft(facts),
    });

    expect(enriched.pricingHealthScore).toBe(facts.pricingHealthScore);
    expect(enriched.revenueOpportunity).toBe(facts.revenueOpportunity);
    expect(enriched.profitOpportunity).toBe(facts.profitOpportunity);
  });
});
