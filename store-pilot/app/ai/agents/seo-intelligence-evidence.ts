import type { SeoIntelligenceFacts } from "../facts/seo-intelligence-facts";

export type SeoIntelligenceEvidenceCatalogEntry = {
  key: string;
  label: string;
  value: string;
  factPath: string;
  section: string;
};

export function buildSeoIntelligenceEvidenceCatalog(
  facts: SeoIntelligenceFacts,
): SeoIntelligenceEvidenceCatalogEntry[] {
  const entries: SeoIntelligenceEvidenceCatalogEntry[] = [
    {
      key: "seo_health_score",
      label: "SEO health score",
      value: `${facts.seoHealthScore}/100`,
      factPath: "seoHealthScore",
      section: "Overview",
    },
    {
      key: "seo_score",
      label: "Overall SEO score",
      value: `${facts.scores.seoScore}/100`,
      factPath: "scores.seoScore",
      section: "Overview",
    },
    {
      key: "technical_seo_score",
      label: "Technical SEO score",
      value: `${facts.scores.technicalSeoScore}/100`,
      factPath: "scores.technicalSeoScore",
      section: "Technical SEO",
    },
    {
      key: "content_score",
      label: "Content score",
      value: `${facts.scores.contentScore}/100`,
      factPath: "scores.contentScore",
      section: "Content",
    },
    {
      key: "indexability_score",
      label: "Indexability score",
      value: `${facts.scores.indexabilityScore}/100`,
      factPath: "scores.indexabilityScore",
      section: "Indexability",
    },
    {
      key: "internal_linking_score",
      label: "Internal linking score",
      value: `${facts.scores.internalLinkingScore}/100`,
      factPath: "scores.internalLinkingScore",
      section: "Internal Linking",
    },
    {
      key: "structured_data_score",
      label: "Structured data score",
      value: `${facts.scores.structuredDataScore}/100`,
      factPath: "scores.structuredDataScore",
      section: "Structured Data",
    },
    {
      key: "core_web_vitals_score",
      label: "Core Web Vitals score",
      value: `${facts.scores.coreWebVitalsScore}/100`,
      factPath: "scores.coreWebVitalsScore",
      section: "Core Web Vitals",
    },
    {
      key: "search_visibility_score",
      label: "Search visibility score",
      value: `${facts.scores.searchVisibilityScore}/100`,
      factPath: "scores.searchVisibilityScore",
      section: "Metadata",
    },
    {
      key: "organic_opportunity_score",
      label: "Organic opportunity score",
      value: `${facts.scores.organicOpportunityScore}/100`,
      factPath: "scores.organicOpportunityScore",
      section: "Content",
    },
    {
      key: "image_optimization_score",
      label: "Image optimization score",
      value: `${facts.scores.imageOptimizationScore}/100`,
      factPath: "scores.imageOptimizationScore",
      section: "Images",
    },
    {
      key: "accessibility_score",
      label: "Accessibility score",
      value: `${facts.scores.accessibilityScore}/100`,
      factPath: "scores.accessibilityScore",
      section: "Accessibility",
    },
    {
      key: "canonical_health_score",
      label: "Canonical health score",
      value: `${facts.scores.canonicalHealth}/100`,
      factPath: "scores.canonicalHealth",
      section: "Technical SEO",
    },
    {
      key: "heading_structure_score",
      label: "Heading structure score",
      value: `${facts.scores.headingStructureScore}/100`,
      factPath: "scores.headingStructureScore",
      section: "Content",
    },
    {
      key: "traffic_opportunity",
      label: "Estimated traffic opportunity",
      value: `${facts.trafficOpportunity}`,
      factPath: "trafficOpportunity",
      section: "Overview",
    },
    {
      key: "visibility_opportunity",
      label: "Visibility opportunity",
      value: `${facts.visibilityOpportunity}`,
      factPath: "visibilityOpportunity",
      section: "Overview",
    },
    {
      key: "rule_set_version",
      label: "SEO rule set version",
      value: facts.ruleSetVersion,
      factPath: "ruleSetVersion",
      section: "Knowledge",
    },
    {
      key: "gsc_impressions_proxy",
      label: "Search impressions proxy",
      value: `${facts.connectors.googleSearchConsole.snapshot.impressionsProxy}`,
      factPath: "connectors.googleSearchConsole.snapshot.impressionsProxy",
      section: "Metadata",
    },
    {
      key: "gsc_average_position_proxy",
      label: "Average position proxy",
      value: `${facts.connectors.googleSearchConsole.snapshot.averagePositionProxy}`,
      factPath: "connectors.googleSearchConsole.snapshot.averagePositionProxy",
      section: "Metadata",
    },
    {
      key: "pagespeed_lcp_score",
      label: "LCP score",
      value: `${facts.coreWebVitals.lcp}/100`,
      factPath: "coreWebVitals.lcp",
      section: "Core Web Vitals",
    },
    {
      key: "pagespeed_cls_score",
      label: "CLS score",
      value: `${facts.coreWebVitals.cls}/100`,
      factPath: "coreWebVitals.cls",
      section: "Core Web Vitals",
    },
    {
      key: "pagespeed_inp_score",
      label: "INP score",
      value: `${facts.coreWebVitals.inp}/100`,
      factPath: "coreWebVitals.inp",
      section: "Core Web Vitals",
    },
    {
      key: "alt_text_coverage",
      label: "Alt text coverage",
      value: `${facts.images.altTextCoverage}%`,
      factPath: "images.altTextCoverage",
      section: "Images",
    },
    {
      key: "critical_issue_count",
      label: "Critical issue count",
      value: `${facts.criticalIssueCount}`,
      factPath: "criticalIssueCount",
      section: "Overview",
    },
  ];

  for (const issue of facts.content.issues.slice(0, 4)) {
    entries.push({
      key: `content_issue_${issue}`,
      label: "Content issue",
      value: issue,
      factPath: `content.issues.${issue}`,
      section: "Content",
    });
  }

  for (const issue of facts.technical.issues.slice(0, 4)) {
    entries.push({
      key: `technical_issue_${issue}`,
      label: "Technical SEO issue",
      value: issue,
      factPath: `technical.issues.${issue}`,
      section: "Technical SEO",
    });
  }

  return entries;
}

export function resolveSeoIntelligenceEvidenceFromKeys(
  keys: string[],
  catalog: SeoIntelligenceEvidenceCatalogEntry[],
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

export function validateSeoIntelligenceEvidenceKeys(
  keys: string[],
  catalog: SeoIntelligenceEvidenceCatalogEntry[],
): void {
  const catalogMap = new Map(catalog.map((entry) => [entry.key, entry]));

  for (const key of keys) {
    if (!catalogMap.has(key)) {
      throw new Error(`invalid_evidence_key:${key}`);
    }
  }
}
