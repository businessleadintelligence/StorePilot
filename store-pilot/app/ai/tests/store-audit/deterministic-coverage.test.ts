import { describe, expect, it } from "vitest";

import { auditHomepage } from "../../tools/homepage-audit-tool";
import { auditNavigation } from "../../tools/navigation-audit-tool";
import { auditCollections } from "../../tools/collection-audit-tool";
import { auditProductPages } from "../../tools/product-page-audit-tool";
import { auditTheme } from "../../tools/theme-audit-tool";
import { auditApps } from "../../tools/app-audit-tool";
import { auditSeo } from "../../tools/seo-audit-tool";
import { auditAccessibility } from "../../tools/accessibility-audit-tool";
import { auditMobileUx } from "../../tools/mobile-ux-tool";
import { auditConversion } from "../../tools/conversion-audit-tool";
import { calculateStoreAuditHealthScore } from "../../tools/audit-health-tool";
import { calculateAuditPriorityScore } from "../../tools/audit-ranking-tool";
import { estimateAuditImpact } from "../../tools/audit-impact-tool";
import { buildStoreAuditRecommendationGroups } from "../../tools/audit-group-tool";
import { dedupeSimilarAuditRecommendations } from "../../tools/audit-similarity-tool";
import { validateStoreAuditEvidenceKeys } from "../../tools/audit-evidence-tool";

describe("Store audit deterministic coverage", () => {
  const toolCases = [
    {
      name: "homepage empty store",
      run: () =>
        auditHomepage({
          storeName: "",
          activeProductCount: 0,
          recentOrderCount: 0,
          hasCompletedOnboarding: false,
        }),
      assert: (result: ReturnType<typeof auditHomepage>) => expect(result.score).toBeLessThan(60),
    },
    {
      name: "navigation minimal catalog",
      run: () =>
        auditNavigation({
          collectionCount: 0,
          activeProductCount: 2,
          duplicateCollectionTitles: 0,
          productsMissingSku: 0,
        }),
      assert: (result: ReturnType<typeof auditNavigation>) =>
        expect(result.searchAvailable).toBe(false),
    },
    {
      name: "collections healthy",
      run: () =>
        auditCollections({
          collectionCount: 6,
          emptyCollections: 0,
          missingDescriptions: 0,
          duplicateCollections: 0,
          missingImages: 0,
        }),
      assert: (result: ReturnType<typeof auditCollections>) => expect(result.score).toBeGreaterThan(65),
    },
    {
      name: "product pages healthy",
      run: () =>
        auditProductPages({
          totalProducts: 20,
          shortTitles: 0,
          missingPrice: 0,
          missingSku: 0,
          draftProducts: 0,
          averageTitleLength: 35,
        }),
      assert: (result: ReturnType<typeof auditProductPages>) => expect(result.score).toBeGreaterThan(70),
    },
    {
      name: "theme healthy",
      run: () =>
        auditTheme({
          activeProductCount: 20,
          webhookCount: 4,
          largeCatalog: false,
          syncLatencyDays: 1,
        }),
      assert: (result: ReturnType<typeof auditTheme>) => expect(result.jsBundleRisk).toBe(false),
    },
    {
      name: "apps lean stack",
      run: () => auditApps({ webhookCount: 4, duplicateWebhookTopics: 0, staleWebhookCount: 0 }),
      assert: (result: ReturnType<typeof auditApps>) => expect(result.score).toBeGreaterThan(70),
    },
    {
      name: "seo healthy",
      run: () =>
        auditSeo({
          productsWithShortTitles: 0,
          productsWithLongTitles: 10,
          totalProducts: 10,
          duplicateTitles: 0,
          missingSku: 0,
        }),
      assert: (result: ReturnType<typeof auditSeo>) => expect(result.structuredDataLikely).toBe(true),
    },
    {
      name: "accessibility healthy",
      run: () =>
        auditAccessibility({
          productsWithoutDescriptiveTitles: 0,
          shortButtonLabels: 0,
          headingOrderIssues: 0,
          missingAltTextProxy: 0,
          totalProducts: 10,
        }),
      assert: (result: ReturnType<typeof auditAccessibility>) =>
        expect(result.altTextCoverage).toBe(100),
    },
    {
      name: "mobile healthy",
      run: () =>
        auditMobileUx({
          averageTitleLength: 24,
          activeProductCount: 12,
          hasPrimaryCta: true,
          menuDepth: 2,
        }),
      assert: (result: ReturnType<typeof auditMobileUx>) => expect(result.stickyCtaLikely).toBe(true),
    },
    {
      name: "conversion healthy",
      run: () =>
        auditConversion({
          recentOrderCount: 30,
          averageOrderValue: 80,
          activeProductCount: 20,
          draftProducts: 0,
          bundleVisibilityScore: 80,
        }),
      assert: (result: ReturnType<typeof auditConversion>) => expect(result.socialProofScore).toBeGreaterThan(80),
    },
  ] as const;

  for (const testCase of toolCases) {
    it(`covers ${testCase.name}`, () => {
      const result = testCase.run();
      testCase.assert(result as never);
    });
  }

  it("computes bounded health score", () => {
    const score = calculateStoreAuditHealthScore({
      homepageScore: 100,
      performanceScore: 100,
      seoScore: 100,
      accessibilityScore: 100,
      conversionScore: 100,
      mobileScore: 100,
      themeScore: 100,
      criticalIssueCount: 0,
    });

    expect(score).toBeLessThanOrEqual(100);
    expect(score).toBeGreaterThan(80);
  });

  it("ranks high-confidence recommendations higher", () => {
    const high = calculateAuditPriorityScore({
      confidence: 0.95,
      difficultyWeight: 1,
      impact: { conversionLift: 5, seoLift: null, performanceGain: null, accessibilityImprovement: null },
      sectionScore: 40,
    });
    const low = calculateAuditPriorityScore({
      confidence: 0.2,
      difficultyWeight: 0.85,
      impact: { conversionLift: 0, seoLift: null, performanceGain: null, accessibilityImprovement: null },
      sectionScore: 85,
    });

    expect(high).toBeGreaterThan(low);
  });

  it("groups recommendations into audit buckets", () => {
    const groups = buildStoreAuditRecommendationGroups([
      { id: "1", group: "Performance Improvements" },
      { id: "2", group: "Long-Term CRO" },
    ]);

    expect(groups.performanceImprovements).toEqual(["1"]);
    expect(groups.longTermCro).toEqual(["2"]);
  });

  it("dedupes audit recommendations by category and title", () => {
    const deduped = dedupeSimilarAuditRecommendations([
      { category: "Apps", title: "Remove stale apps", confidence: 0.7 },
      { category: "Apps", title: "Remove stale apps", confidence: 0.85 },
    ]);

    expect(deduped).toHaveLength(1);
  });

  it("validates evidence keys in catalog map", () => {
    const catalog = {
      seo_score: {
        key: "seo_score",
        section: "SEO",
        label: "SEO score",
        value: "76",
        severity: "info" as const,
      },
    };

    expect(validateStoreAuditEvidenceKeys(["seo_score"], catalog).valid).toBe(true);
    expect(validateStoreAuditEvidenceKeys(["missing"], catalog).unknownKeys).toEqual(["missing"]);
  });

  it("estimates accessibility impact", () => {
    const impact = estimateAuditImpact({
      category: "Accessibility",
      confidence: 0.8,
      sectionScore: 55,
    });

    expect(impact.accessibilityImprovement).toBeGreaterThan(0);
  });

  it("estimates performance impact for apps", () => {
    const impact = estimateAuditImpact({
      category: "Apps",
      confidence: 0.75,
      sectionScore: 50,
    });

    expect(impact.performanceGain).toBeGreaterThan(0);
  });
});
