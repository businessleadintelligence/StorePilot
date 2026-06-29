import type { GrowthIntelligenceFacts } from "../facts/growth-intelligence-facts";

export type GrowthIntelligenceEvidenceCatalogEntry = {
  key: string;
  label: string;
  value: string;
  factPath: string;
  section: string;
};

export function buildGrowthIntelligenceEvidenceCatalog(
  facts: GrowthIntelligenceFacts,
): GrowthIntelligenceEvidenceCatalogEntry[] {
  const entries: GrowthIntelligenceEvidenceCatalogEntry[] = [
    {
      key: "growth_score",
      label: "Growth score",
      value: `${facts.scores.growthScore}/100`,
      factPath: "scores.growthScore",
      section: "Overview",
    },
    {
      key: "growth_health_score",
      label: "Growth health score",
      value: `${facts.growthHealthScore}/100`,
      factPath: "growthHealthScore",
      section: "Overview",
    },
    {
      key: "revenue_growth_rate",
      label: "Revenue growth rate",
      value: `${facts.scores.revenueGrowthRate}%`,
      factPath: "scores.revenueGrowthRate",
      section: "Revenue Growth",
    },
    {
      key: "aov",
      label: "Average order value",
      value: `$${facts.scores.aov}`,
      factPath: "scores.aov",
      section: "AOV Growth",
    },
    {
      key: "aov_growth_rate",
      label: "AOV growth rate",
      value: `${facts.scores.aovGrowthRate}%`,
      factPath: "scores.aovGrowthRate",
      section: "AOV Growth",
    },
    {
      key: "repeat_purchase_rate",
      label: "Repeat purchase rate",
      value: `${facts.scores.repeatPurchaseRate}%`,
      factPath: "scores.repeatPurchaseRate",
      section: "Repeat Purchases",
    },
    {
      key: "returning_customer_rate",
      label: "Returning customer rate",
      value: `${facts.scores.returningCustomerRate}%`,
      factPath: "scores.returningCustomerRate",
      section: "Retention",
    },
    {
      key: "retention_score",
      label: "Retention score",
      value: `${facts.scores.retentionScore}/100`,
      factPath: "scores.retentionScore",
      section: "Retention",
    },
    {
      key: "upsell_opportunity",
      label: "Upsell opportunity",
      value: `${facts.scores.upsellOpportunity}/100`,
      factPath: "scores.upsellOpportunity",
      section: "Upsell",
    },
    {
      key: "cross_sell_opportunity",
      label: "Cross-sell opportunity",
      value: `${facts.scores.crossSellOpportunity}/100`,
      factPath: "scores.crossSellOpportunity",
      section: "Cross-sell",
    },
    {
      key: "collection_growth_score",
      label: "Collection growth score",
      value: `${facts.scores.collectionGrowthScore}/100`,
      factPath: "scores.collectionGrowthScore",
      section: "Collections",
    },
    {
      key: "campaign_readiness_score",
      label: "Campaign readiness score",
      value: `${facts.scores.campaignReadinessScore}/100`,
      factPath: "scores.campaignReadinessScore",
      section: "Campaigns",
    },
    {
      key: "landing_page_growth_score",
      label: "Landing page growth score",
      value: `${facts.scores.landingPageGrowthScore}/100`,
      factPath: "scores.landingPageGrowthScore",
      section: "Landing Pages",
    },
    {
      key: "merchandising_score",
      label: "Merchandising score",
      value: `${facts.scores.merchandisingScore}/100`,
      factPath: "scores.merchandisingScore",
      section: "Merchandising",
    },
    {
      key: "seasonal_strength",
      label: "Seasonal strength",
      value: `${facts.scores.seasonalStrength}`,
      factPath: "scores.seasonalStrength",
      section: "Seasonal Growth",
    },
    {
      key: "forecast_growth_rate",
      label: "Forecast growth rate",
      value: `${facts.scores.forecastGrowthRate}%`,
      factPath: "scores.forecastGrowthRate",
      section: "Customer Lifetime Value",
    },
    {
      key: "revenue_30",
      label: "30-day revenue",
      value: `$${facts.storeTotals.totalRevenue30}`,
      factPath: "storeTotals.totalRevenue30",
      section: "Revenue Growth",
    },
    {
      key: "revenue_opportunity",
      label: "Revenue opportunity",
      value: `${facts.scores.revenueOpportunity}`,
      factPath: "scores.revenueOpportunity",
      section: "Overview",
    },
    {
      key: "aov_opportunity",
      label: "AOV opportunity",
      value: `${facts.scores.profitOpportunity}`,
      factPath: "scores.profitOpportunity",
      section: "Overview",
    },
    {
      key: "upsell_candidates",
      label: "Upsell candidates",
      value: `${facts.strategySignals.upsellCandidates}`,
      factPath: "strategySignals.upsellCandidates",
      section: "Upsell",
    },
    {
      key: "cross_sell_pairs",
      label: "Cross-sell pairs",
      value: `${facts.strategySignals.crossSellPairs}`,
      factPath: "strategySignals.crossSellPairs",
      section: "Cross-sell",
    },
    {
      key: "campaign_ready_segments",
      label: "Campaign-ready segments",
      value: `${facts.strategySignals.campaignReadySegments}`,
      factPath: "strategySignals.campaignReadySegments",
      section: "Campaigns",
    },
    {
      key: "critical_issue_count",
      label: "Critical issue count",
      value: `${facts.criticalIssueCount}`,
      factPath: "criticalIssueCount",
      section: "Overview",
    },
  ];

  for (const issue of facts.revenue.issues.slice(0, 4)) {
    entries.push({
      key: `revenue_issue_${issue}`,
      label: "Revenue issue",
      value: issue,
      factPath: `revenue.issues.${issue}`,
      section: "Revenue Growth",
    });
  }

  return entries;
}

export function resolveGrowthIntelligenceEvidenceFromKeys(
  keys: string[],
  catalog: GrowthIntelligenceEvidenceCatalogEntry[],
): string[] {
  const catalogMap = new Map(catalog.map((entry) => [entry.key, entry]));
  return keys.map((key) => {
    const entry = catalogMap.get(key);
    if (!entry) throw new Error(`invalid_evidence_key:${key}`);
    return `${entry.label}: ${entry.value}`;
  });
}

export function validateGrowthIntelligenceEvidenceKeys(
  keys: string[],
  catalog: GrowthIntelligenceEvidenceCatalogEntry[],
): void {
  const catalogMap = new Map(catalog.map((entry) => [entry.key, entry]));
  for (const key of keys) {
    if (!catalogMap.has(key)) throw new Error(`invalid_evidence_key:${key}`);
  }
}

function sectionScoreForCategory(facts: GrowthIntelligenceFacts, category: string): number {
  const mapping: Record<string, number> = {
    "Revenue Growth": facts.revenue.score,
    "AOV Growth": facts.aov.score,
    Upsell: facts.upsell.upsellOpportunity,
    "Cross-sell": facts.crossSell.crossSellOpportunity,
    Retention: facts.retention.retentionScore,
    "Repeat Purchases": facts.repeatPurchases.score,
    Collections: facts.collections.collectionGrowthScore,
    Campaigns: facts.campaigns.campaignReadinessScore,
    Merchandising: facts.merchandising.merchandisingScore,
    "Seasonal Growth": Math.min(100, facts.seasonality.seasonalStrength * 20),
    "Landing Pages": facts.landingPages.landingPageGrowthScore,
    "Customer Lifetime Value": Math.max(0, Math.min(100, 50 + facts.forecast.forecastGrowthRate)),
  };

  return mapping[category] ?? facts.scores.growthScore;
}

function sectionIssuesForCategory(facts: GrowthIntelligenceFacts, category: string): string[] {
  const mapping: Record<string, string[]> = {
    "Revenue Growth": facts.revenue.issues,
    "AOV Growth": facts.aov.issues,
    Upsell: facts.upsell.issues,
    "Cross-sell": facts.crossSell.issues,
    Retention: facts.retention.issues,
    "Repeat Purchases": facts.repeatPurchases.issues,
    Collections: facts.collections.issues,
    Campaigns: facts.campaigns.issues,
    Merchandising: facts.merchandising.issues,
    "Seasonal Growth": facts.seasonality.issues,
    "Landing Pages": facts.landingPages.issues,
    "Customer Lifetime Value": facts.forecast.issues,
  };

  return mapping[category] ?? [];
}

export { sectionScoreForCategory, sectionIssuesForCategory };
