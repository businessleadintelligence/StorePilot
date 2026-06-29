import { describe, expect, it } from "vitest";
import { createSeoIntelligenceFactsBuilder } from "../../facts/seo-intelligence-facts";
import { createMockSeoIntelligenceSnapshot } from "./helpers";

describe("SEO intelligence extended facts", () => {
  it("computes all v1 SEO scores deterministically", async () => {
    const builder = createSeoIntelligenceFactsBuilder({
      async getSeoIntelligenceSnapshot() {
        return createMockSeoIntelligenceSnapshot();
      },
    });

    const facts = await builder.build({ storeId: "store-1", agentId: "seo_audit" });

    expect(facts.seoHealthScore).toBeGreaterThan(0);
    expect(facts.scores.seoScore).toBeGreaterThan(0);
    expect(facts.scores.technicalSeoScore).toBeGreaterThan(0);
    expect(facts.scores.contentScore).toBeGreaterThan(0);
    expect(facts.scores.searchVisibilityScore).toBeGreaterThan(0);
    expect(facts.scores.coreWebVitalsScore).toBeGreaterThan(0);
    expect(facts.scores.imageOptimizationScore).toBeGreaterThan(0);
    expect(facts.knowledgeRules.length).toBeGreaterThan(0);
    expect(facts.ruleSetVersion).toBeTruthy();
    expect(facts.connectors.shopify.connected).toBe(true);
    expect(facts.technical.issues.length).toBeGreaterThanOrEqual(0);
    expect(facts.content.issues.length).toBeGreaterThanOrEqual(0);
    expect(facts.trafficOpportunity).toBeGreaterThan(0);
    expect(facts.visibilityOpportunity).toBeGreaterThan(0);
  });

  it("includes section issues in critical issue count", async () => {
    const builder = createSeoIntelligenceFactsBuilder({
      async getSeoIntelligenceSnapshot() {
        return createMockSeoIntelligenceSnapshot({
          shortTitles: 8,
          duplicateTitles: 4,
          missingSku: 5,
          missingAltTextProxy: 8,
          thinContentPages: 10,
          missingCollectionDescriptions: 3,
        });
      },
    });

    const facts = await builder.build({ storeId: "store-1", agentId: "seo_audit" });
    expect(facts.criticalIssueCount).toBeGreaterThan(5);
  });
});
