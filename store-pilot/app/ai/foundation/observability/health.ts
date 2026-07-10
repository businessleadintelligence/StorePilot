import type { FoundationMetricsSnapshot } from "../types/foundation-types";
import type { ProviderHealthStatus } from "../types/provider-types";
import { createProviderRouter } from "../provider-router";
import { createFoundationMetricsCollector } from "../metrics/metrics-collector";

export type FoundationHealthReport = {
  ok: boolean;
  timestamp: string;
  providers: ProviderHealthStatus[];
  metrics: FoundationMetricsSnapshot;
};

export async function getFoundationHealthReport(
  metrics = createFoundationMetricsCollector(),
): Promise<FoundationHealthReport> {
  const router = createProviderRouter();
  const providers = await router.healthCheckAll();
  const unhealthy = providers.filter((provider) => !provider.healthy);

  return {
    ok: unhealthy.length === 0,
    timestamp: new Date().toISOString(),
    providers,
    metrics: metrics.snapshot(),
  };
}

export function getFoundationDashboardMetrics(
  metrics = createFoundationMetricsCollector(),
): FoundationMetricsSnapshot {
  return metrics.snapshot();
}
