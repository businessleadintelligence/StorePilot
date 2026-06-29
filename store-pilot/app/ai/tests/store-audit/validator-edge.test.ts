import { describe, expect, it } from "vitest";

import { AIPlatformError } from "../../core/ai-errors";
import {
  buildStoreAuditFactsFromSnapshot,
  buildValidStoreAuditDraft,
} from "./helpers";
import { validateStoreAuditBusinessRules } from "../../agents/store-audit.validator";
import { dedupeSimilarStoreAuditRecommendations } from "../../agents/store-audit-similarity";
import { buildStoreAuditRecommendationGroups } from "../../agents/store-audit-groups";
import { estimateStoreAuditRecommendationImpactForFacts } from "../../agents/store-audit-impact";
import { rankStoreAuditRecommendations } from "../../agents/store-audit-ranking";
import { buildStoreAuditHealthExplanation } from "../../agents/store-audit-health";
import { validateStoreAuditEvidenceKeys } from "../../agents/store-audit-evidence";

describe("Store Audit validator edge cases", () => {
  it("rejects empty recommendations", () => {
    const facts = buildStoreAuditFactsFromSnapshot();
    const output = buildValidStoreAuditDraft(facts);
    output.recommendations = [];

    expect(() => validateStoreAuditBusinessRules(facts, output)).toThrow(AIPlatformError);
  });

  it("rejects unknown section in findings", () => {
    const facts = buildStoreAuditFactsFromSnapshot();
    const output = buildValidStoreAuditDraft(facts);
    output.findings[0] = {
      ...output.findings[0]!,
      section: "Unknown Section" as never,
    };

    expect(() => validateStoreAuditBusinessRules(facts, output)).toThrow(AIPlatformError);
  });

  it("rejects implemented recommendations from facts", () => {
    const facts = buildStoreAuditFactsFromSnapshot();
    facts.implementedRecommendationIds = ["audit:homepage-social-proof"];
    const output = buildValidStoreAuditDraft(facts);

    expect(() => validateStoreAuditBusinessRules(facts, output)).toThrow(AIPlatformError);
  });

  it("rejects duplicate similar recommendations", () => {
    const facts = buildStoreAuditFactsFromSnapshot();
    const output = buildValidStoreAuditDraft(facts);
    output.recommendations[1] = {
      ...output.recommendations[0]!,
      id: "audit:duplicate-homepage",
    };

    expect(() => validateStoreAuditBusinessRules(facts, output)).toThrow(AIPlatformError);
  });

  it("rejects homepage score mismatch", () => {
    const facts = buildStoreAuditFactsFromSnapshot();
    const output = buildValidStoreAuditDraft(facts);
    output.homepageScore = facts.homepageScore + 1;

    expect(() => validateStoreAuditBusinessRules(facts, output)).toThrow(AIPlatformError);
  });
});

describe("Store Audit enrichment modules", () => {
  it("dedupes similar recommendations before ranking", () => {
    const deduped = dedupeSimilarStoreAuditRecommendations([
      {
        id: "a",
        category: "SEO",
        title: "Improve product titles",
        reason: "Titles are too short across the catalog",
        evidenceKeys: ["seo_score"],
        merchantAction: ["Expand titles"],
        expectedResult: "Better SEO",
        estimatedImpact: "SEO lift",
        difficulty: "Easy",
        priority: 2,
        confidence: 0.7,
        verificationCriteria: "SEO score improves",
        timeline: "2 weeks",
      },
      {
        id: "b",
        category: "SEO",
        title: "Improve product titles",
        reason: "Duplicate SEO recommendation should collapse",
        evidenceKeys: ["seo_score"],
        merchantAction: ["Expand titles"],
        expectedResult: "Better SEO",
        estimatedImpact: "SEO lift",
        difficulty: "Easy",
        priority: 2,
        confidence: 0.9,
        verificationCriteria: "SEO score improves",
        timeline: "2 weeks",
      },
    ]);

    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.confidence).toBe(0.9);
  });

  it("builds recommendation groups", () => {
    const groups = buildStoreAuditRecommendationGroups([
      { id: "a", group: "Critical Fixes" },
      { id: "b", group: "SEO Improvements" },
      { id: "c", group: "Quick Wins" },
    ]);

    expect(groups.criticalFixes).toEqual(["a"]);
    expect(groups.seoImprovements).toEqual(["b"]);
    expect(groups.quickWins).toEqual(["c"]);
  });

  it("estimates impact for SEO recommendations", () => {
    const facts = buildStoreAuditFactsFromSnapshot();
    const recommendation = buildValidStoreAuditDraft(facts).recommendations.find(
      (item) => item.category === "Product Pages",
    )!;
    const impact = estimateStoreAuditRecommendationImpactForFacts(facts, recommendation);

    expect(impact.conversionLift ?? impact.seoLift ?? 0).toBeGreaterThanOrEqual(0);
  });

  it("ranks recommendations by priority score", () => {
    const facts = buildStoreAuditFactsFromSnapshot();
    const drafts = buildValidStoreAuditDraft(facts).recommendations;
    const impacts = new Map(
      drafts.map((draft) => [
        draft.id,
        estimateStoreAuditRecommendationImpactForFacts(facts, draft),
      ]),
    );

    const ranked = rankStoreAuditRecommendations({
      facts,
      recommendations: drafts,
      impacts,
    });

    expect(ranked[0]?.priorityScore).toBeGreaterThanOrEqual(ranked[1]?.priorityScore ?? 0);
  });

  it("builds health explanation with drivers", () => {
    const explanation = buildStoreAuditHealthExplanation(buildStoreAuditFactsFromSnapshot());

    expect(explanation.summary).toContain("Store audit health");
    expect(explanation.drivers.length).toBe(4);
  });

  it("validates evidence keys against catalog", () => {
    const catalog = [
      {
        key: "seo_score",
        label: "SEO score",
        value: "76/100",
        factPath: "seoScore",
        section: "SEO",
      },
    ];

    expect(() => validateStoreAuditEvidenceKeys(["seo_score"], catalog)).not.toThrow();
    expect(() => validateStoreAuditEvidenceKeys(["missing"], catalog)).toThrow();
  });
});
