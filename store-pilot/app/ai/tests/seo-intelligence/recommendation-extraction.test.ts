import { describe, expect, it } from "vitest";

import { extractSeoIntelligenceRecommendations } from "../../agents/seo-intelligence.validator";
import { buildValidSeoIntelligenceDraft, buildSeoIntelligenceFactsFromSnapshot } from "./helpers";
import { runWithSeoIntelligenceContext } from "../../agents/agent-execution-context";
import { seoIntelligenceEnrichedSchema } from "../../schemas/seo-intelligence";
import { mutateAndEnrichSeoIntelligenceOutput } from "../../agents/seo-intelligence-enrichment";
import { getAgentDefinition } from "../../agents/agent-registry";

describe("SEO Intelligence recommendation extraction", () => {
  it("filters implemented recommendations from extraction", async () => {
    const facts = await buildSeoIntelligenceFactsFromSnapshot();
    const output = buildValidSeoIntelligenceDraft(facts);

    runWithSeoIntelligenceContext(
      {
        storeId: "store-1",
        subjectKey: "seo-intelligence:store-1",
        recommendationMemory: {
          implementedIds: new Set(["seo:metadata-titles"]),
          dismissedIds: new Set(),
          openIds: new Set(),
          snoozedIds: new Set(),
          ignoredIds: new Set(),
        },
      },
      () => {
        const extracted = extractSeoIntelligenceRecommendations(output);
        expect(extracted.some((item) => item.title.includes("metadata"))).toBe(false);
      },
    );
  });

  it("deprioritizes dismissed recommendations", async () => {
    const facts = await buildSeoIntelligenceFactsFromSnapshot();
    const output = buildValidSeoIntelligenceDraft(facts);

    runWithSeoIntelligenceContext(
      {
        storeId: "store-1",
        subjectKey: "seo-intelligence:store-1",
        recommendationMemory: {
          implementedIds: new Set(),
          dismissedIds: new Set(["seo:image-alt-text"]),
          openIds: new Set(),
          snoozedIds: new Set(),
          ignoredIds: new Set(),
        },
      },
      () => {
        const extracted = extractSeoIntelligenceRecommendations(output);
        const dismissed = extracted.find((item) => item.title.includes("alt text"));
        expect(dismissed?.priority).toBeGreaterThan(2);
      },
    );
  });

  it("enriched schema includes verification and tasks", async () => {
    const facts = await buildSeoIntelligenceFactsFromSnapshot();
    const enriched = mutateAndEnrichSeoIntelligenceOutput({
      facts,
      output: buildValidSeoIntelligenceDraft(facts),
    });

    expect(seoIntelligenceEnrichedSchema.safeParse(enriched).success).toBe(true);
    expect(enriched.recommendations[0]?.tasks.length).toBeGreaterThan(0);
    expect(enriched.recommendations[0]?.verification.expectedWindow).toBeTruthy();
  });

  it("registers SEO intelligence agent with extractRecommendations hook", async () => {
    const definition = getAgentDefinition("seo_audit");
    const facts = await buildSeoIntelligenceFactsFromSnapshot();
    const output = buildValidSeoIntelligenceDraft(facts);
    const enriched = mutateAndEnrichSeoIntelligenceOutput({ facts, output });

    expect(definition.extractRecommendations).toBeDefined();

    const extracted = definition.extractRecommendations!({
      agentId: "seo_audit",
      subjectKey: "seo-intelligence:store-1",
      output: enriched,
    });

    expect(extracted.length).toBeGreaterThan(0);
    expect(extracted[0]?.category).toBeTruthy();
  });
});

describe("SEO Intelligence score invariants", () => {
  it("preserves SEO health score through enrichment", async () => {
    const facts = await buildSeoIntelligenceFactsFromSnapshot();
    const enriched = mutateAndEnrichSeoIntelligenceOutput({
      facts,
      output: buildValidSeoIntelligenceDraft(facts),
    });

    expect(enriched.seoHealthScore).toBe(facts.seoHealthScore);
    expect(enriched.trafficOpportunity).toBe(facts.trafficOpportunity);
    expect(enriched.visibilityOpportunity).toBe(facts.visibilityOpportunity);
  });
});
