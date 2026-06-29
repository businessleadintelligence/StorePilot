import { describe, expect, it } from "vitest";

import { auditAccessibility } from "../../tools/accessibility-audit-tool";
import { auditApps } from "../../tools/app-audit-tool";
import { calculateStoreAuditHealthScore } from "../../tools/audit-health-tool";
import { estimateAuditImpact } from "../../tools/audit-impact-tool";
import { assignStoreAuditRecommendationGroup } from "../../tools/audit-group-tool";
import { calculateAuditPriorityScore } from "../../tools/audit-ranking-tool";
import { dedupeSimilarAuditRecommendations } from "../../tools/audit-similarity-tool";
import { auditHomepage } from "../../tools/homepage-audit-tool";
import { auditSeo } from "../../tools/seo-audit-tool";
import { createStoreAuditFactsBuilder } from "../../facts/store-audit-facts";
import { buildStoreAuditEvidenceCatalog } from "../../agents/store-audit-evidence";
import { buildStoreAuditFactsFromSnapshot, createMockStoreAuditSnapshot } from "./helpers";

describe("Store audit deterministic tools", () => {
  it("scores homepage readiness from catalog and onboarding signals", () => {
    const result = auditHomepage({
      storeName: "Acme Outfitters",
      activeProductCount: 12,
      recentOrderCount: 15,
      hasCompletedOnboarding: true,
    });

    expect(result.score).toBeGreaterThan(60);
    expect(result.signals.hasPrimaryCta).toBe(true);
  });

  it("flags SEO gaps from title and description coverage", () => {
    const result = auditSeo({
      productsWithShortTitles: 3,
      productsWithLongTitles: 6,
      totalProducts: 12,
      duplicateTitles: 1,
      missingSku: 2,
    });

    expect(result.issues).toContain("seo_short_titles");
    expect(result.score).toBeLessThan(90);
  });

  it("estimates audit impact by category", () => {
    const impact = estimateAuditImpact({
      category: "SEO",
      confidence: 0.8,
      sectionScore: 55,
    });

    expect(impact.seoLift).toBeGreaterThan(0);
  });

  it("assigns recommendation groups", () => {
    expect(
      assignStoreAuditRecommendationGroup({
        category: "SEO",
        priorityScore: 72,
        hasDeterministicImpact: true,
      }),
    ).toBe("SEO Improvements");
  });

  it("dedupes similar recommendations", () => {
    const deduped = dedupeSimilarAuditRecommendations([
      { category: "Homepage", title: "Add social proof", confidence: 0.7, priorityScore: 60 },
      { category: "Homepage", title: "Add social proof", confidence: 0.9, priorityScore: 80 },
    ]);

    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.confidence).toBe(0.9);
  });

  it("builds facts from snapshot source", async () => {
    const snapshot = createMockStoreAuditSnapshot();
    const builder = createStoreAuditFactsBuilder({
      async getStoreAuditSnapshot() {
        return snapshot;
      },
    });

    const facts = await builder.build({ storeId: "store-1", agentId: "store_audit" });

    expect(facts.storeHealthScore).toBeGreaterThan(0);
    expect(facts.overallAuditScore).toBe(facts.storeHealthScore);
    expect(facts.navigationScore).toBeGreaterThan(0);
    expect(facts.homepage.score).toBeGreaterThan(0);
    expect(facts.seo.titleCoverage).toBeGreaterThan(0);
  });

  it("builds evidence catalog from facts", () => {
    const catalog = buildStoreAuditEvidenceCatalog(buildStoreAuditFactsFromSnapshot());

    expect(catalog.some((entry) => entry.key === "store_health_score")).toBe(true);
    expect(catalog.some((entry) => entry.key === "homepage_score")).toBe(true);
  });

  it("calculates composite health score", () => {
    const score = calculateStoreAuditHealthScore({
      homepageScore: 78,
      performanceScore: 72,
      seoScore: 76,
      accessibilityScore: 71,
      conversionScore: 69,
      mobileScore: 73,
      themeScore: 70,
      criticalIssueCount: 3,
    });

    expect(score).toBeGreaterThan(50);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("audits apps and accessibility proxies", () => {
    expect(
      auditApps({ webhookCount: 12, duplicateWebhookTopics: 1, staleWebhookCount: 2 }).issues.length,
    ).toBeGreaterThan(0);
    expect(
      auditAccessibility({
        productsWithoutDescriptiveTitles: 2,
        shortButtonLabels: 1,
        headingOrderIssues: 1,
        missingAltTextProxy: 3,
        totalProducts: 12,
      }).altTextCoverage,
    ).toBeGreaterThan(0);
  });

  it("ranks audit recommendations by priority score", () => {
    const score = calculateAuditPriorityScore({
      confidence: 0.9,
      difficultyWeight: 1,
      impact: { conversionLift: 4, seoLift: null, performanceGain: null, accessibilityImprovement: null },
      sectionScore: 55,
    });

    expect(score).toBeGreaterThan(50);
  });
});
