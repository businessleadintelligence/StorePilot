import { describe, expect, it } from "vitest";

import { auditHomepage } from "../../tools/homepage-audit-tool";
import { auditSeo } from "../../tools/seo-audit-tool";
import { calculateStoreAuditHealthScore } from "../../tools/audit-health-tool";
import { estimateAuditImpact } from "../../tools/audit-impact-tool";
import { assignStoreAuditRecommendationGroup } from "../../tools/audit-group-tool";
import { areAuditRecommendationsSimilar } from "../../tools/audit-similarity-tool";
import { buildStoreAuditEvidenceCatalog } from "../../agents/store-audit-evidence";
import { buildStoreAuditFactsFromSnapshot } from "./helpers";
import { STORE_AUDIT_INTELLIGENCE_GROUPS, STORE_AUDIT_INTELLIGENCE_CATEGORIES } from "../../schemas/store-audit-intelligence";

describe("Store audit tool matrix", () => {
  for (const category of STORE_AUDIT_INTELLIGENCE_CATEGORIES) {
    it(`supports category ${category}`, () => {
      expect(category.length).toBeGreaterThan(2);
    });
  }

  for (const group of STORE_AUDIT_INTELLIGENCE_GROUPS) {
    it(`supports group ${group}`, () => {
      expect(group.length).toBeGreaterThan(2);
    });
  }

  it("scores homepage with low catalog as weak", () => {
    const weak = auditHomepage({
      storeName: "A",
      activeProductCount: 1,
      recentOrderCount: 0,
      hasCompletedOnboarding: false,
    });

    expect(weak.score).toBeLessThan(60);
    expect(weak.issues.length).toBeGreaterThan(0);
  });

  it("scores homepage with strong catalog as healthy", () => {
    const strong = auditHomepage({
      storeName: "Acme Outfitters",
      activeProductCount: 20,
      recentOrderCount: 25,
      hasCompletedOnboarding: true,
    });

    expect(strong.score).toBeGreaterThan(80);
  });

  it("scores SEO with duplicate titles lower", () => {
    const withDuplicates = auditSeo({
      productsWithShortTitles: 0,
      productsWithLongTitles: 10,
      totalProducts: 10,
      duplicateTitles: 3,
      missingSku: 0,
    });
    const withoutDuplicates = auditSeo({
      productsWithShortTitles: 0,
      productsWithLongTitles: 10,
      totalProducts: 10,
      duplicateTitles: 0,
      missingSku: 0,
    });

    expect(withDuplicates.score).toBeLessThan(withoutDuplicates.score);
  });

  it("calculates health score penalties for critical issues", () => {
    const lowIssues = calculateStoreAuditHealthScore({
      homepageScore: 80,
      performanceScore: 80,
      seoScore: 80,
      accessibilityScore: 80,
      conversionScore: 80,
      mobileScore: 80,
      themeScore: 80,
      criticalIssueCount: 0,
    });
    const highIssues = calculateStoreAuditHealthScore({
      homepageScore: 80,
      performanceScore: 80,
      seoScore: 80,
      accessibilityScore: 80,
      conversionScore: 80,
      mobileScore: 80,
      themeScore: 80,
      criticalIssueCount: 8,
    });

    expect(highIssues).toBeLessThan(lowIssues);
  });

  it("assigns performance groups for theme categories", () => {
    expect(
      assignStoreAuditRecommendationGroup({
        category: "Theme",
        priorityScore: 80,
        hasDeterministicImpact: true,
      }),
    ).toBe("Performance Improvements");
  });

  it("detects similar recommendations", () => {
    expect(
      areAuditRecommendationsSimilar(
        { category: "SEO", title: "Improve titles" },
        { category: "SEO", title: "Improve titles" },
      ),
    ).toBe(true);
    expect(
      areAuditRecommendationsSimilar(
        { category: "SEO", title: "Improve titles" },
        { category: "Homepage", title: "Improve titles" },
      ),
    ).toBe(false);
  });

  it("estimates conversion impact for conversion category", () => {
    const impact = estimateAuditImpact({
      category: "Conversion Optimization",
      confidence: 0.85,
      sectionScore: 50,
    });

    expect(impact.conversionLift).toBeGreaterThan(0);
  });

  it("builds evidence catalog with section coverage", () => {
    const catalog = buildStoreAuditEvidenceCatalog(buildStoreAuditFactsFromSnapshot());
    const keys = catalog.map((entry) => entry.key);

    expect(keys).toContain("store_health_score");
    expect(keys).toContain("homepage_score");
    expect(keys).toContain("seo_score");
    expect(keys).toContain("accessibility_score");
    expect(keys).toContain("performance_score");
    expect(keys).toContain("conversion_score");
    expect(keys).toContain("mobile_score");
    expect(keys).toContain("theme_score");
    expect(keys).toContain("overall_audit_score");
    expect(keys).toContain("overall_audit_score");
  });
});
