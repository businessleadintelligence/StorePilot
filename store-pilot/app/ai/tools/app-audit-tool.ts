export type AppAuditRecommendation = "keep" | "remove" | "replace";

export function auditApps(input: {
  webhookCount: number;
  duplicateWebhookTopics: number;
  staleWebhookCount: number;
}): {
  score: number;
  issues: string[];
  installedApps: number;
  unusedApps: number;
  duplicateApps: number;
  recommendations: Array<{ label: string; action: AppAuditRecommendation }>;
} {
  const issues: string[] = [];
  const installedApps = input.webhookCount;
  const unusedApps = input.staleWebhookCount;
  const duplicateApps = input.duplicateWebhookTopics;

  if (unusedApps > 0) issues.push("app_unused_detected");
  if (duplicateApps > 0) issues.push("app_duplicate_detected");
  if (installedApps > 10) issues.push("app_performance_impact");

  const recommendations: Array<{ label: string; action: AppAuditRecommendation }> = [];
  if (unusedApps > 0) recommendations.push({ label: "Stale integrations", action: "remove" });
  if (duplicateApps > 0) recommendations.push({ label: "Duplicate webhook topics", action: "replace" });
  if (installedApps <= 8) recommendations.push({ label: "Core integrations", action: "keep" });

  let score = 80;
  score -= unusedApps * 6;
  score -= duplicateApps * 8;
  score -= Math.max(0, installedApps - 10) * 3;

  return {
    score: Math.max(0, Math.min(100, score)),
    issues,
    installedApps,
    unusedApps,
    duplicateApps,
    recommendations,
  };
}
