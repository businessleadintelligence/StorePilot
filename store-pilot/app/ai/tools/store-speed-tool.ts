export function analyzeStoreSpeed(input: {
  activeProductCount: number;
  webhookCount: number;
  syncLatencyDays: number | null;
  largeCatalog: boolean;
}): {
  score: number;
  issues: string[];
  estimatedPageWeightRisk: boolean;
  syncLatencyRisk: boolean;
} {
  const issues: string[] = [];
  const estimatedPageWeightRisk = input.webhookCount > 6 || input.activeProductCount > 150;
  const syncLatencyRisk = input.syncLatencyDays !== null && input.syncLatencyDays > 5;

  if (estimatedPageWeightRisk) issues.push("store_speed_heavy_integrations");
  if (syncLatencyRisk) issues.push("store_speed_stale_sync");
  if (input.largeCatalog && input.webhookCount > 4) issues.push("store_speed_catalog_script_bloat");

  let score = 78;
  if (estimatedPageWeightRisk) score -= 14;
  if (syncLatencyRisk) score -= 8;
  if (input.activeProductCount > 200) score -= 6;

  return {
    score: Math.max(0, Math.min(100, score)),
    issues,
    estimatedPageWeightRisk,
    syncLatencyRisk,
  };
}
