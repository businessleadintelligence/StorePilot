import { describe, expect, it } from "vitest";

import { AIPlatformError } from "../../core/ai-errors";
import {
  buildSeoIntelligenceFactsFromSnapshot,
  buildValidSeoIntelligenceDraft,
} from "./helpers";
import { validateSeoIntelligenceBusinessRules } from "../../agents/seo-intelligence.validator";
import { dedupeSimilarSeoRecommendations } from "../../tools/seo-similarity-tool";
import { buildSeoRecommendationGroups } from "../../agents/seo-intelligence-groups";
import { estimateSeoRecommendationImpactForFacts } from "../../agents/seo-intelligence-impact";
import { rankSeoIntelligenceRecommendations } from "../../agents/seo-intelligence-ranking";
import { buildSeoIntelligenceHealthExplanation } from "../../agents/seo-intelligence-health";
import { validateSeoIntelligenceEvidenceKeys } from "../../agents/seo-intelligence-evidence";
import { resolvePrimaryRuleForCategory, SEO_KNOWLEDGE_RULE_SET_VERSION } from "../../knowledge/seo-knowledge-layer";

describe("SEO Intelligence validator edge cases", () => {
  it("rejects empty recommendations", async () => {
    const facts = await buildSeoIntelligenceFactsFromSnapshot();
    const output = buildValidSeoIntelligenceDraft(facts);
    output.recommendations = [];

    expect(() => validateSeoIntelligenceBusinessRules(facts, output)).toThrow(AIPlatformError);
  });

  it("rejects unknown section in findings", async () => {
    const facts = await buildSeoIntelligenceFactsFromSnapshot();
    const output = buildValidSeoIntelligenceDraft(facts);
    output.contentFindings[0] = {
      ...output.contentFindings[0]!,
      category: "Unknown Section" as never,
    };

    expect(() => validateSeoIntelligenceBusinessRules(facts, output)).toThrow(AIPlatformError);
  });

  it("rejects implemented recommendations from facts", async () => {
    const facts = await buildSeoIntelligenceFactsFromSnapshot();
    facts.implementedRecommendationIds = ["seo:metadata-titles"];
    const output = buildValidSeoIntelligenceDraft(facts);

    expect(() => validateSeoIntelligenceBusinessRules(facts, output)).toThrow(AIPlatformError);
  });

  it("rejects duplicate similar recommendations", async () => {
    const facts = await buildSeoIntelligenceFactsFromSnapshot();
    const output = buildValidSeoIntelligenceDraft(facts);
    output.recommendations[1] = {
      ...output.recommendations[0]!,
      id: "seo:duplicate-metadata",
    };

    expect(() => validateSeoIntelligenceBusinessRules(facts, output)).toThrow(AIPlatformError);
  });

  it("rejects seo health score mismatch in draft", async () => {
    const facts = await buildSeoIntelligenceFactsFromSnapshot();
    const output = buildValidSeoIntelligenceDraft(facts);
    output.seoHealthScore = facts.seoHealthScore + 1;

    expect(() => validateSeoIntelligenceBusinessRules(facts, output)).toThrow(AIPlatformError);
  });
});

describe("SEO Intelligence enrichment modules", () => {
  it("dedupes similar recommendations before ranking", () => {
    const metadataRule = resolvePrimaryRuleForCategory("Metadata")!;
    const deduped = dedupeSimilarSeoRecommendations([
      {
        category: "Metadata",
        title: "Expand product titles",
        confidence: 0.7,
        priorityScore: 60,
      },
      {
        category: "Metadata",
        title: "Expand product titles",
        confidence: 0.9,
        priorityScore: 80,
      },
    ]);

    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.confidence).toBe(0.9);
    expect(metadataRule.ruleVersion).toBe(SEO_KNOWLEDGE_RULE_SET_VERSION);
  });

  it("builds recommendation groups", () => {
    const groups = buildSeoRecommendationGroups([
      { id: "a", group: "Critical Fixes" },
      { id: "b", group: "Organic Growth" },
      { id: "c", group: "Quick Wins" },
    ]);

    expect(groups.criticalFixes).toEqual(["a"]);
    expect(groups.organicGrowth).toEqual(["b"]);
    expect(groups.quickWins).toEqual(["c"]);
  });

  it("estimates impact for metadata recommendations", async () => {
    const facts = await buildSeoIntelligenceFactsFromSnapshot();
    const recommendation = buildValidSeoIntelligenceDraft(facts).recommendations.find(
      (item) => item.category === "Metadata",
    )!;
    const impact = estimateSeoRecommendationImpactForFacts(facts, recommendation);

    expect(impact.trafficGain ?? impact.visibilityLift ?? 0).toBeGreaterThanOrEqual(0);
  });

  it("ranks recommendations by priority score", async () => {
    const facts = await buildSeoIntelligenceFactsFromSnapshot();
    const drafts = buildValidSeoIntelligenceDraft(facts).recommendations;
    const impacts = new Map(
      drafts.map((draft) => [draft.id, estimateSeoRecommendationImpactForFacts(facts, draft)]),
    );

    const ranked = rankSeoIntelligenceRecommendations({
      facts,
      recommendations: drafts,
      impacts,
    });

    expect(ranked[0]?.priorityScore).toBeGreaterThanOrEqual(ranked[1]?.priorityScore ?? 0);
  });

  it("builds health explanation with drivers", async () => {
    const explanation = buildSeoIntelligenceHealthExplanation(await buildSeoIntelligenceFactsFromSnapshot());

    expect(explanation.summary.length).toBeGreaterThan(0);
    expect(explanation.drivers.length).toBeGreaterThan(0);
  });

  it("validates evidence keys against catalog", () => {
    const catalog = [
      {
        key: "seo_health_score",
        label: "SEO health score",
        value: "74/100",
        factPath: "seoHealthScore",
        section: "Overview",
      },
    ];

    expect(() => validateSeoIntelligenceEvidenceKeys(["seo_health_score"], catalog)).not.toThrow();
    expect(() => validateSeoIntelligenceEvidenceKeys(["missing"], catalog)).toThrow();
  });
});
