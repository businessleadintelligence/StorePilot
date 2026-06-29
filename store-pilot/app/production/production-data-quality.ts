import { loadUnifiedStoreMetricsForFacts } from "../ai/migration/unified-metrics-provider";
import type { ProductionDataQualityExplanation } from "./production-types";

const CONNECTOR_IMPACT: Record<string, string> = {
  ga4: "Traffic and conversion metrics incomplete",
  gsc: "SEO visibility metrics incomplete",
  pagespeed: "Performance metrics incomplete",
  clarity: "Behavior metrics incomplete",
};

export async function computeProductionDataQuality(storeId: string): Promise<ProductionDataQualityExplanation> {
  const unified = await loadUnifiedStoreMetricsForFacts(storeId);
  const dq = unified.dataQuality;
  const impactChain: string[] = [];

  for (const connector of dq.missingConnectors) {
    impactChain.push(`${connector.toUpperCase()} missing`);
    impactChain.push(CONNECTOR_IMPACT[connector] ?? "Data coverage reduced");
  }

  for (const connector of dq.staleConnectors) {
    impactChain.push(`${connector.toUpperCase()} stale`);
    impactChain.push("Freshness score reduced for dependent intelligence");
  }

  if (dq.score < 70) {
    impactChain.push("Growth Intelligence confidence reduced");
    impactChain.push("Revenue estimates may be less accurate");
  }

  if (impactChain.length === 0) {
    impactChain.push("Data quality supports full intelligence coverage");
  }

  return {
    score: dq.score,
    completeness: dq.completenessScore,
    freshness: dq.freshnessScore,
    reliability: dq.reliabilityScore,
    missingConnectors: [...dq.missingConnectors],
    staleConnectors: [...dq.staleConnectors],
    impactChain,
  };
}
