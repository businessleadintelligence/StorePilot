import prisma from "../db.server";
import { buildSubsystemHealth } from "./production-checks";
import type { ProductionSubsystemHealth } from "./production-types";

export async function monitorPerformanceHealth(storeId: string): Promise<ProductionSubsystemHealth> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [agentLatency, jobLatency, webhookCount] = await Promise.all([
    prisma.aiAgentRun.aggregate({
      where: { storeId, completedAt: { gte: since }, latencyMs: { gt: 0 } },
      _avg: { latencyMs: true },
    }),
    prisma.syncJob.aggregate({
      where: { storeId, completedAt: { gte: since }, durationMs: { gt: 0 } },
      _avg: { durationMs: true },
    }),
    prisma.webhookEvent.count({ where: { storeId, createdAt: { gte: since } } }),
  ]);

  const avgAgentMs =
    agentLatency._avg?.latencyMs != null ? Math.round(agentLatency._avg.latencyMs) : null;
  const avgJobMs =
    jobLatency._avg?.durationMs != null ? Math.round(jobLatency._avg.durationMs) : null;
  const level =
    (avgAgentMs ?? 0) > 120_000 || (avgJobMs ?? 0) > 300_000 ? "warning" : "healthy";

  return buildSubsystemHealth({
    id: "performance",
    label: "Performance",
    level,
    averageLatencyMs: avgAgentMs ?? avgJobMs,
    details: {
      avgAgentLatencyMs: avgAgentMs,
      avgJobDurationMs: avgJobMs,
      webhooks7d: webhookCount,
    },
  });
}

export async function monitorAiPlatformHealth(storeId: string): Promise<ProductionSubsystemHealth> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  const [totalRuns, failedRuns, avgLatency, cacheEntries, runsToday, lastRun] = await Promise.all([
    prisma.aiAgentRun.count({ where: { storeId, startedAt: { gte: since } } }),
    prisma.aiAgentRun.count({ where: { storeId, startedAt: { gte: since }, status: "failed" } }),
    prisma.aiAgentRun.aggregate({
      where: { storeId, startedAt: { gte: since }, latencyMs: { gt: 0 } },
      _avg: { latencyMs: true },
    }),
    prisma.aiResultCacheEntry.count({ where: { storeId } }),
    prisma.aiAgentRun.count({ where: { storeId, startedAt: { gte: dayStart } } }),
    prisma.aiAgentRun.findFirst({
      where: { storeId },
      orderBy: { startedAt: "desc" },
      select: { startedAt: true, agentId: true, status: true },
    }),
  ]);

  const failureRate = totalRuns <= 0 ? 0 : failedRuns / totalRuns;
  const level =
    failureRate >= 0.5 ? "critical" : runsToday <= 0 ? "warning" : failureRate >= 0.2 ? "warning" : "healthy";

  return buildSubsystemHealth({
    id: "ai_platform",
    label: "AI Platform",
    level,
    failureCount: failedRuns,
    averageLatencyMs:
      avgLatency._avg?.latencyMs != null ? Math.round(avgLatency._avg.latencyMs) : null,
    lastSync: lastRun?.startedAt.toISOString() ?? null,
    recoverySuggestion:
      runsToday <= 0
        ? "No agent executions recorded today — verify agent scheduling"
        : failureRate >= 0.2
          ? "Review failed agent runs in Command Center"
          : null,
    details: {
      runs24h: totalRuns,
      failed24h: failedRuns,
      cacheEntries,
      runsToday,
      lastAgentId: lastRun?.agentId ?? null,
      lastStatus: lastRun?.status ?? null,
    },
  });
}
