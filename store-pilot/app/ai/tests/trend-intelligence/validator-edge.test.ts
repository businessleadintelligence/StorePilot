import { describe, expect, it } from "vitest";
import { AIPlatformError } from "../../core/ai-errors";
import { validateTrendIntelligenceBusinessRules } from "../../agents/trend-intelligence.validator";
import { dedupeSimilarTrendRecommendationsFromTools } from "../../agents/trend-intelligence-similarity";
import { buildTrendRecommendationGroups } from "../../agents/trend-intelligence-groups";
import { estimateTrendRecommendationImpactForFacts } from "../../agents/trend-intelligence-impact";
import { rankTrendRecommendationsForFacts } from "../../agents/trend-intelligence-ranking";
import { buildValidTrendIntelligenceDraft, buildTrendFactsFromSnapshot } from "./helpers";

describe("Trend Intelligence validator edge cases", () => {
  it("rejects empty recommendations", () => {
    const facts = buildTrendFactsFromSnapshot();
    const output = buildValidTrendIntelligenceDraft(facts);
    output.recommendations = [];
    expect(() => validateTrendIntelligenceBusinessRules(facts, output)).toThrow(AIPlatformError);
  });

  it("rejects contradictory emerging recommendation without emerging products", () => {
    const facts = buildTrendFactsFromSnapshot();
    facts.emergingProductIds = [];
    const output = buildValidTrendIntelligenceDraft(facts);
    output.recommendations.push({
      id: "trend:invalid-emerging",
      category: "Emerging Opportunity",
      title: "Restock a product with no emerging signal",
      reason: "This recommendation contradicts the empty emerging product set.",
      evidenceKeys: ["emerging_product_count"],
      merchantAction: ["Do not execute this invalid recommendation"],
      expectedResult: "Should fail validation",
      estimatedImpact: "None",
      difficulty: "Easy",
      priority: 2,
      confidence: 0.5,
      verificationCriteria: "Validation rejects contradictory trend output",
      timeline: "1 week",
      productId: "product-missing",
    });
    expect(() => validateTrendIntelligenceBusinessRules(facts, output)).toThrow(AIPlatformError);
  });

  it("dedupes similar recommendations", () => {
    const deduped = dedupeSimilarTrendRecommendationsFromTools([
      {
        id: "a",
        category: "Emerging Opportunity",
        title: "Restock Blue Hoodie inventory",
        reason: "Emerging demand requires replenishment before stockouts",
        evidenceKeys: ["emerging_product_count"],
        merchantAction: ["Restock"],
        expectedResult: "Capture demand",
        estimatedImpact: "Revenue lift",
        difficulty: "Easy",
        priority: 2,
        confidence: 0.7,
        verificationCriteria: "Sales increase",
        timeline: "2 weeks",
      },
      {
        id: "b",
        category: "Emerging Opportunity",
        title: "Restock Blue Hoodie inventory",
        reason: "Duplicate emerging recommendation should collapse",
        evidenceKeys: ["emerging_product_count"],
        merchantAction: ["Restock"],
        expectedResult: "Capture demand",
        estimatedImpact: "Revenue lift",
        difficulty: "Easy",
        priority: 2,
        confidence: 0.9,
        verificationCriteria: "Sales increase",
        timeline: "2 weeks",
      },
    ]);
    expect(deduped).toHaveLength(1);
  });

  it("builds groups and ranks recommendations", () => {
    const facts = buildTrendFactsFromSnapshot();
    const drafts = buildValidTrendIntelligenceDraft(facts).recommendations;
    const impacts = new Map(
      drafts.map((draft) => [draft.id, estimateTrendRecommendationImpactForFacts(facts, draft)]),
    );
    const ranked = rankTrendRecommendationsForFacts({ facts, recommendations: drafts, impacts });
    expect(ranked[0]?.priorityScore).toBeGreaterThan(0);
    const groups = buildTrendRecommendationGroups([
      { id: "a", group: "Emerging Opportunities" },
      { id: "b", group: "Decline Mitigation" },
    ]);
    expect(groups.emergingOpportunities).toEqual(["a"]);
  });
});
