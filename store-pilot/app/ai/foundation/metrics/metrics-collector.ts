import type { FoundationMetricsSnapshot } from "../types/foundation-types";
import type { FoundationLogEntry } from "../logging/foundation-logger";
import { roundUsd } from "../utils/json";

export class FoundationMetricsCollector {
  private readonly logs: FoundationLogEntry[] = [];

  record(entry: FoundationLogEntry): void {
    this.logs.push(entry);
  }

  snapshot(referenceDate = new Date()): FoundationMetricsSnapshot {
    const dayStart = new Date(
      referenceDate.getFullYear(),
      referenceDate.getMonth(),
      referenceDate.getDate(),
    );
    const monthStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);

    const recent = this.logs;
    const successes = recent.filter((entry) => entry.success);
    const failures = recent.filter((entry) => !entry.success);
    const cacheHits = recent.filter((entry) => entry.cacheHit);
    const retried = recent.filter((entry) => entry.retryCount > 0);

    const averageLatencyMs =
      successes.length > 0
        ? successes.reduce((sum, entry) => sum + entry.latencyMs, 0) /
          successes.length
        : 0;

    const totalTokens = recent.reduce(
      (sum, entry) => sum + entry.promptTokens + entry.completionTokens,
      0,
    );

    const totalCostUsd = roundUsd(
      recent.reduce((sum, entry) => sum + entry.estimatedCostUsd, 0),
    );

    const dailySpendUsd = roundUsd(
      recent
        .filter((entry) => new Date(entry.timestamp) >= dayStart)
        .reduce((sum, entry) => sum + entry.estimatedCostUsd, 0),
    );

    const monthlySpendUsd = roundUsd(
      recent
        .filter((entry) => new Date(entry.timestamp) >= monthStart)
        .reduce((sum, entry) => sum + entry.estimatedCostUsd, 0),
    );

    const providerUptime: Record<string, number> = {};
    const modelDistribution: Record<string, number> = {};
    for (const entry of successes) {
      if (entry.providerId) {
        providerUptime[entry.providerId] =
          (providerUptime[entry.providerId] ?? 0) + 1;
      }
      if (entry.modelId) {
        modelDistribution[entry.modelId] =
          (modelDistribution[entry.modelId] ?? 0) + 1;
      }
    }

    return {
      averageLatencyMs,
      cacheHitRate: recent.length ? cacheHits.length / recent.length : 0,
      totalTokens,
      totalCostUsd,
      failureRate: recent.length ? failures.length / recent.length : 0,
      retryRate: recent.length ? retried.length / recent.length : 0,
      providerUptime,
      modelDistribution,
      dailySpendUsd,
      monthlySpendUsd,
    };
  }
}

export function createFoundationMetricsCollector(): FoundationMetricsCollector {
  return new FoundationMetricsCollector();
}
