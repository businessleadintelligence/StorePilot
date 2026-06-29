import type { StoreAuditFacts } from "../facts/store-audit-facts";

export type StoreAuditEvidenceCatalogEntry = {
  key: string;
  label: string;
  value: string;
  factPath: string;
  section: string;
};

export function buildStoreAuditEvidenceCatalog(facts: StoreAuditFacts): StoreAuditEvidenceCatalogEntry[] {
  const entries: StoreAuditEvidenceCatalogEntry[] = [
    {
      key: "store_health_score",
      label: "Store health score",
      value: `${facts.storeHealthScore}/100`,
      factPath: "storeHealthScore",
      section: "Overview",
    },
    {
      key: "homepage_score",
      label: "Homepage score",
      value: `${facts.homepageScore}/100`,
      factPath: "homepageScore",
      section: "Homepage",
    },
    {
      key: "seo_score",
      label: "SEO score",
      value: `${facts.seoScore}/100`,
      factPath: "seoScore",
      section: "SEO",
    },
    {
      key: "accessibility_score",
      label: "Accessibility score",
      value: `${facts.accessibilityScore}/100`,
      factPath: "accessibilityScore",
      section: "Accessibility",
    },
    {
      key: "performance_score",
      label: "Performance score",
      value: `${facts.performanceScore}/100`,
      factPath: "performanceScore",
      section: "Theme",
    },
    {
      key: "conversion_score",
      label: "Conversion score",
      value: `${facts.conversionScore}/100`,
      factPath: "conversionScore",
      section: "Conversion Optimization",
    },
    {
      key: "mobile_score",
      label: "Mobile UX score",
      value: `${facts.mobileScore}/100`,
      factPath: "mobileScore",
      section: "Mobile UX",
    },
    {
      key: "theme_score",
      label: "Theme score",
      value: `${facts.themeScore}/100`,
      factPath: "themeScore",
      section: "Theme",
    },
    {
      key: "navigation_score",
      label: "Navigation score",
      value: `${facts.navigationScore}/100`,
      factPath: "navigationScore",
      section: "Navigation",
    },
    {
      key: "technical_seo_score",
      label: "Technical SEO score",
      value: `${facts.technicalSeoScore}/100`,
      factPath: "technicalSeoScore",
      section: "Technical SEO",
    },
    {
      key: "image_optimization_score",
      label: "Image optimization score",
      value: `${facts.imageOptimizationScore}/100`,
      factPath: "imageOptimizationScore",
      section: "Images",
    },
    {
      key: "trust_score",
      label: "Trust score",
      value: `${facts.trustScore}/100`,
      factPath: "trustScore",
      section: "Trust Signals",
    },
    {
      key: "policy_score",
      label: "Policy score",
      value: `${facts.policyScore}/100`,
      factPath: "policyScore",
      section: "Policies",
    },
    {
      key: "app_bloat_score",
      label: "App bloat score",
      value: `${facts.appBloatScore}/100`,
      factPath: "appBloatScore",
      section: "Apps",
    },
    {
      key: "merchant_best_practices_score",
      label: "Merchant best practices score",
      value: `${facts.merchantBestPracticesScore}/100`,
      factPath: "merchantBestPracticesScore",
      section: "Merchant Best Practices",
    },
    {
      key: "overall_audit_score",
      label: "Overall audit score",
      value: `${facts.overallAuditScore}/100`,
      factPath: "overallAuditScore",
      section: "Overview",
    },
    {
      key: "critical_issue_count",
      label: "Critical issue count",
      value: `${facts.criticalIssueCount}`,
      factPath: "criticalIssueCount",
      section: "Overview",
    },
    {
      key: "homepage_primary_cta",
      label: "Primary CTA readiness",
      value: facts.homepage.signals.hasPrimaryCta ? "Ready" : "Missing",
      factPath: "homepage.signals.hasPrimaryCta",
      section: "Homepage",
    },
    {
      key: "navigation_search",
      label: "Search availability",
      value: facts.navigation.searchAvailable ? "Available" : "Unavailable",
      factPath: "navigation.searchAvailable",
      section: "Navigation",
    },
    {
      key: "seo_title_coverage",
      label: "SEO title coverage",
      value: `${facts.seo.titleCoverage}%`,
      factPath: "seo.titleCoverage",
      section: "SEO",
    },
    {
      key: "accessibility_alt_coverage",
      label: "Alt text coverage proxy",
      value: `${facts.accessibility.altTextCoverage}%`,
      factPath: "accessibility.altTextCoverage",
      section: "Accessibility",
    },
    {
      key: "apps_installed",
      label: "Installed integrations",
      value: `${facts.apps.installedApps}`,
      factPath: "apps.installedApps",
      section: "Apps",
    },
    {
      key: "apps_unused",
      label: "Unused integrations",
      value: `${facts.apps.unusedApps}`,
      factPath: "apps.unusedApps",
      section: "Apps",
    },
    {
      key: "product_missing_sku",
      label: "Products missing SKU",
      value: `${facts.productPages.missingSku}`,
      factPath: "productPages.missingSku",
      section: "Product Pages",
    },
    {
      key: "conversion_social_proof",
      label: "Social proof score",
      value: `${facts.conversion.socialProofScore}/100`,
      factPath: "conversion.socialProofScore",
      section: "Conversion Optimization",
    },
  ];

  for (const issue of facts.homepage.issues.slice(0, 4)) {
    entries.push({
      key: `homepage_issue_${issue}`,
      label: "Homepage issue",
      value: issue,
      factPath: `homepage.issues.${issue}`,
      section: "Homepage",
    });
  }

  for (const issue of facts.seo.issues.slice(0, 4)) {
    entries.push({
      key: `seo_issue_${issue}`,
      label: "SEO issue",
      value: issue,
      factPath: `seo.issues.${issue}`,
      section: "SEO",
    });
  }

  return entries;
}

export function resolveStoreAuditEvidenceFromKeys(
  keys: string[],
  catalog: StoreAuditEvidenceCatalogEntry[],
): string[] {
  const catalogMap = new Map(catalog.map((entry) => [entry.key, entry]));

  return keys.map((key) => {
    const entry = catalogMap.get(key);
    if (!entry) {
      throw new Error(`invalid_evidence_key:${key}`);
    }

    return `${entry.label}: ${entry.value}`;
  });
}

export function validateStoreAuditEvidenceKeys(
  keys: string[],
  catalog: StoreAuditEvidenceCatalogEntry[],
): void {
  const catalogMap = new Map(catalog.map((entry) => [entry.key, entry]));

  for (const key of keys) {
    if (!catalogMap.has(key)) {
      throw new Error(`invalid_evidence_key:${key}`);
    }
  }
}
