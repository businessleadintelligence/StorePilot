import { describe, expect, it } from "vitest";

import { auditNavigation } from "../../tools/navigation-audit-tool";
import { auditCollections } from "../../tools/collection-audit-tool";
import { auditProductPages } from "../../tools/product-page-audit-tool";
import { auditTheme } from "../../tools/theme-audit-tool";
import { auditApps } from "../../tools/app-audit-tool";
import { auditAccessibility } from "../../tools/accessibility-audit-tool";
import { auditMobileUx } from "../../tools/mobile-ux-tool";
import { auditConversion } from "../../tools/conversion-audit-tool";
import { classifyStoreAuditHealthBand } from "../../tools/audit-health-tool";
import { deriveAuditOverallPriority, deriveAuditOverallConfidence } from "../../tools/audit-ranking-tool";
import { buildStoreAuditSubjectKey } from "../../../services/store-audit.server";
import { evidenceKeyFor } from "../../tools/audit-evidence-tool";

describe("Store audit additional tools", () => {
  it("audits navigation depth and search availability", () => {
    const result = auditNavigation({
      collectionCount: 14,
      activeProductCount: 20,
      duplicateCollectionTitles: 1,
      productsMissingSku: 2,
    });

    expect(result.menuDepth).toBeGreaterThan(3);
    expect(result.issues).toContain("navigation_menu_too_deep");
  });

  it("audits collection structure gaps", () => {
    const result = auditCollections({
      collectionCount: 4,
      emptyCollections: 1,
      missingDescriptions: 2,
      duplicateCollections: 1,
      missingImages: 1,
    });

    expect(result.score).toBeLessThan(70);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("audits product page completeness", () => {
    const result = auditProductPages({
      totalProducts: 10,
      shortTitles: 3,
      missingPrice: 1,
      missingSku: 2,
      draftProducts: 1,
      averageTitleLength: 18,
    });

    expect(result.issues).toContain("product_short_title");
    expect(result.descriptionScore).toBeLessThan(60);
  });

  it("audits theme performance risks", () => {
    const result = auditTheme({
      activeProductCount: 250,
      webhookCount: 12,
      largeCatalog: true,
      syncLatencyDays: 10,
    });

    expect(result.jsBundleRisk).toBe(true);
    expect(result.issues).toContain("theme_large_js_bundle_risk");
  });

  it("audits app footprint and recommendations", () => {
    const result = auditApps({
      webhookCount: 14,
      duplicateWebhookTopics: 2,
      staleWebhookCount: 3,
    });

    expect(result.recommendations.some((item) => item.action === "remove")).toBe(true);
  });

  it("audits accessibility proxies", () => {
    const result = auditAccessibility({
      productsWithoutDescriptiveTitles: 4,
      shortButtonLabels: 2,
      headingOrderIssues: 1,
      missingAltTextProxy: 5,
      totalProducts: 10,
    });

    expect(result.altTextCoverage).toBe(50);
    expect(result.issues).toContain("accessibility_low_alt_coverage");
  });

  it("audits mobile UX readiness", () => {
    const result = auditMobileUx({
      averageTitleLength: 10,
      activeProductCount: 12,
      hasPrimaryCta: true,
      menuDepth: 4,
    });

    expect(result.issues).toContain("mobile_small_touch_targets");
    expect(result.stickyCtaLikely).toBe(true);
  });

  it("audits conversion optimization signals", () => {
    const result = auditConversion({
      recentOrderCount: 2,
      averageOrderValue: 18,
      activeProductCount: 12,
      draftProducts: 1,
      bundleVisibilityScore: 40,
    });

    expect(result.issues).toContain("conversion_missing_social_proof");
    expect(result.socialProofScore).toBeLessThan(60);
  });

  it("classifies health bands and overall priority", () => {
    expect(classifyStoreAuditHealthBand(85)).toBe("strong");
    expect(classifyStoreAuditHealthBand(65)).toBe("watch");
    expect(classifyStoreAuditHealthBand(40)).toBe("weak");
    expect(deriveAuditOverallPriority([90, 70])).toBe(1);
    expect(deriveAuditOverallConfidence([0.8, 0.6])).toBe(0.7);
  });

  it("builds store audit subject key and evidence keys", () => {
    expect(buildStoreAuditSubjectKey("store-123")).toBe("store-audit:store-123");
    expect(evidenceKeyFor("Homepage", "primary_cta")).toBe("homepage.primary_cta");
  });
});
