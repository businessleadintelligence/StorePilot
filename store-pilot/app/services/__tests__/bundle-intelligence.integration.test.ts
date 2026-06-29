import { describe, expect, it } from "vitest";

import { buildBundleDiscoverySubjectKey } from "../bundle-intelligence.server";
import {
  areBundleRecommendationsSimilar,
  dedupeSimilarBundleRecommendations,
} from "../../ai/agents/bundle-discovery-similarity";
import {
  getBundleRecommendationExpirationReason,
  shouldExpireBundleRecommendation,
} from "../../ai/agents/bundle-discovery-expiration";
import { buildBundleEvidenceCatalog, resolveBundleEvidenceFromKeys } from "../../ai/agents/bundle-discovery-evidence";
import { estimateBundleRecommendationImpactForFacts } from "../../ai/agents/bundle-discovery-impact";
import {
  calculateBundleRecommendationPriorityScore,
  deriveBundleOverallConfidence,
  deriveBundleOverallPriority,
} from "../../ai/agents/bundle-discovery-ranking";
import { bundleIntelligenceSchema, bundleIntelligenceEnrichedSchema } from "../../ai/schemas/bundle-intelligence";
import { buildBundleFactsFromSnapshot, buildValidBundleDiscoveryDraft } from "../../ai/tests/bundle-discovery/helpers";

describe("Bundle Discovery integration helpers", () => {
  it("uses store-scoped subject keys", () => {
    expect(buildBundleDiscoverySubjectKey("abc")).toBe("bundle:abc");
  });

  it("dedupes similar bundle recommendations by product set", () => {
    const deduped = dedupeSimilarBundleRecommendations([
      {
        id: "bundle:product-1:product-2",
        category: "Starter Kit",
        title: "Launch Blue Hoodie + Beanie starter kit",
        reason: "Strong co-purchase signal",
        bundleProductIds: ["product-1", "product-2"],
        evidenceKeys: ["candidate_count"],
        merchantAction: ["Create starter kit"],
        estimatedDifficulty: "Easy",
        confidence: 0.9,
        expectedResult: "Increase attach rate",
        potentialRisk: "Margin compression",
        estimatedTime: "1 week",
        businessImpact: "Capture co-purchase behavior",
      },
      {
        id: "bundle:product-1:product-2:copy",
        category: "Starter Kit",
        title: "Bundle Blue Hoodie with Beanie Hat",
        reason: "Duplicate bundle opportunity",
        bundleProductIds: ["product-2", "product-1"],
        evidenceKeys: ["candidate_count"],
        merchantAction: ["Bundle on PDP"],
        estimatedDifficulty: "Easy",
        confidence: 0.85,
        expectedResult: "Increase attach rate",
        potentialRisk: "Margin compression",
        estimatedTime: "1 week",
        businessImpact: "Capture co-purchase behavior",
      },
    ]);

    expect(deduped).toHaveLength(1);
    expect(
      areBundleRecommendationsSimilar(
        { bundleProductIds: ["product-1", "product-2"] },
        { bundleProductIds: ["product-2", "product-1"] },
      ),
    ).toBe(true);
  });

  it("expires resolved bundle recommendations", () => {
    const facts = buildBundleFactsFromSnapshot();
    const resolvedFacts = {
      ...facts,
      candidateCount: 0,
      bundleHealthScore: 85,
      highConfidenceCount: 0,
    };

    expect(
      getBundleRecommendationExpirationReason({
        facts: resolvedFacts,
        payload: { category: "Starter Kit" },
      }),
    ).toBe("attach_rate_normalized");
    expect(
      shouldExpireBundleRecommendation({
        facts: resolvedFacts,
        payload: { category: "Starter Kit" },
        status: "open",
      }),
    ).toBe(true);
  });

  it("does not expire verified bundle recommendations", () => {
    const facts = buildBundleFactsFromSnapshot();
    expect(
      shouldExpireBundleRecommendation({
        facts,
        payload: { category: "Starter Kit" },
        status: "verified",
      }),
    ).toBe(false);
  });

  it("builds bundle evidence catalog entries from facts", () => {
    const facts = buildBundleFactsFromSnapshot();
    const catalog = buildBundleEvidenceCatalog(facts);
    const evidence = resolveBundleEvidenceFromKeys(["bundle_health_score", "candidate_count"], catalog);

    expect(evidence[0]).toContain("Bundle health score");
    expect(evidence[1]).toContain("Bundle candidates");
  });

  it("estimates bundle impact from facts", () => {
    const facts = buildBundleFactsFromSnapshot();
    const candidate = facts.bundleCandidates[0];
    const impact = estimateBundleRecommendationImpactForFacts(facts, {
      id: candidate.id,
      bundleProductIds: candidate.productIds,
    });

    expect(impact.attachRateLift).toBeGreaterThan(0);
    expect(impact.estimatedBundleValue).toBeGreaterThan(0);
  });

  it("derives bundle priority and confidence from ranked recommendations", () => {
    const facts = buildBundleFactsFromSnapshot();
    const draft = buildValidBundleDiscoveryDraft(facts);
    const ranked = draft.recommendations.map((recommendation) => ({
      ...recommendation,
      priorityScore: calculateBundleRecommendationPriorityScore({
        facts,
        recommendation,
        impact: { attachRateLift: 0.1, inventoryUnitsReduced: 4, bundleOrdersExpected: 2 },
      }),
    }));

    expect(deriveBundleOverallPriority(ranked)).toBeGreaterThanOrEqual(1);
    expect(deriveBundleOverallConfidence(ranked)).toBeGreaterThan(0);
  });

  it("parses bundle intelligence draft schema", () => {
    const facts = buildBundleFactsFromSnapshot();
    const draft = buildValidBundleDiscoveryDraft(facts);

    expect(bundleIntelligenceSchema.safeParse(draft).success).toBe(true);
  });

  it("requires enriched recommendation fields in enriched schema", () => {
    const facts = buildBundleFactsFromSnapshot();
    const draft = buildValidBundleDiscoveryDraft(facts);

    expect(bundleIntelligenceEnrichedSchema.safeParse(draft).success).toBe(false);
  });

  it("expires implemented bundle recommendations when product set is already bundled", () => {
    const facts = buildBundleFactsFromSnapshot();
    facts.implementedBundleIds = ["bundle:product-1:product-2"];

    expect(
      getBundleRecommendationExpirationReason({
        facts,
        payload: {
          category: "Starter Kit",
          bundleProductIds: ["product-1", "product-2"],
        },
      }),
    ).toBe("bundle_implemented");
  });
});
