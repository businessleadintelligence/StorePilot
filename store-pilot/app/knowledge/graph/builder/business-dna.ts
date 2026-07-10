import type { GraphStatisticsSnapshot } from "../shared/types";

export async function upsertBusinessDnaNode(
  storeId: string,
  stats: GraphStatisticsSnapshot,
): Promise<void> {
  const { createGraphNodeStore } = await import("../nodes/node-store");
  const nodes = createGraphNodeStore();

  const seoMaturity = Math.round(stats.evidenceCoverage * 100);
  const aiConfidence = Math.round(
    (stats.evidenceCoverage * 0.4 +
      stats.businessCoverage * 0.35 +
      stats.relationshipCoverage * 0.25) *
      100,
  );

  const profile = {
    storeType: inferStoreType(stats),
    revenueStrategy: stats.totalEdges > 100 ? "High Volume" : "Emerging",
    pricingStrategy: stats.relationshipCoverage > 0.3 ? "Premium" : "Standard",
    inventoryStyle: stats.businessCoverage > 0.5 ? "Fast Moving" : "Balanced",
    seoMaturityPercent: seoMaturity,
    operationalComplexity: stats.totalNodes > 500 ? "High" : "Moderate",
    growthStage: inferGrowthStage(stats),
    aiConfidencePercent: aiConfidence,
  };

  await nodes.upsert({
    storeId,
    nodeType: "BusinessDNA",
    canonicalKey: storeId,
    displayName: "Business DNA",
    confidence: aiConfidence / 100,
    metadata: profile,
  });
}

function inferStoreType(stats: GraphStatisticsSnapshot): string {
  if (stats.businessCoverage > 0.6) {
    return "Fashion";
  }
  if (stats.totalNodes > 1000) {
    return "General Merchandise";
  }
  return "Specialty";
}

function inferGrowthStage(stats: GraphStatisticsSnapshot): string {
  if (stats.totalNodes > 5000) {
    return "Mature";
  }
  if (stats.totalNodes > 500) {
    return "Scaling";
  }
  return "Early";
}

export type { GraphStatisticsSnapshot as BusinessDnaStatsInput };
