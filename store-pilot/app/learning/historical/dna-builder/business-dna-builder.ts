import type { GraphStatisticsSnapshot } from "../../../knowledge/graph/shared/types";
import type { HistoricalAggregationSnapshot } from "../shared/types";

export function buildBusinessDnaFromHistorical(input: {
  stats: GraphStatisticsSnapshot;
  snapshot: HistoricalAggregationSnapshot;
  patternCount: number;
  overallConfidencePercent: number;
}): Record<string, unknown> {
  const { stats, snapshot, patternCount, overallConfidencePercent } = input;

  return {
    storeType: inferStoreType(stats, snapshot),
    revenueStrategy: snapshot.orderCount > 500 ? "High Volume" : "Emerging",
    pricingStrategy:
      (snapshot.evidenceByFactType.PriceAboveCategoryAverage ?? 0) > 0
        ? "Premium"
        : "Standard",
    inventoryStyle:
      snapshot.lowStockEvidenceCount + snapshot.outOfStockEvidenceCount > 5
        ? "Fast Moving"
        : "Balanced",
    seoMaturityPercent: Math.round(stats.evidenceCoverage * 100),
    operationalComplexity: stats.totalNodes > 500 ? "High" : "Moderate",
    growthStage: inferGrowthStage(stats, snapshot),
    aiConfidencePercent: overallConfidencePercent,
    historicalPatternCount: patternCount,
    averageOrderValue: snapshot.averageOrderValue,
    totalRevenue: snapshot.totalRevenue,
    refundRatio: snapshot.refundRatio,
    source: "historical_intelligence_engine",
  };
}

function inferStoreType(
  stats: GraphStatisticsSnapshot,
  snapshot: HistoricalAggregationSnapshot,
): string {
  if (stats.businessCoverage > 0.6 || snapshot.activeProductCount > 200) {
    return "Fashion";
  }
  if (stats.totalNodes > 1000) {
    return "General Merchandise";
  }
  return "Specialty";
}

function inferGrowthStage(
  stats: GraphStatisticsSnapshot,
  snapshot: HistoricalAggregationSnapshot,
): string {
  if (stats.totalNodes > 5000 || snapshot.orderCount > 5000) {
    return "Mature";
  }
  if (stats.totalNodes > 500 || snapshot.orderCount > 500) {
    return "Scaling";
  }
  return "Early";
}
