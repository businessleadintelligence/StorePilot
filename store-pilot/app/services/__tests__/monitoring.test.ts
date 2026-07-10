import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  checkAiHealth,
  checkCronHealth,
  checkDatabaseHealth,
  checkQueueHealth,
  checkShopifyApiHealth,
  checkSupabaseHealth,
  checkWorkerHealth,
  getLivenessReport,
  getMonitoringReport,
  getReadinessReport,
} from "../monitoring.server";
import { getCronWorkerHealth } from "../cron-worker.server";
import { getJobQueueMetrics } from "../job.server";
import { getStartupReadiness } from "../startup-readiness.server";
import { getWorkerInfrastructureHealth } from "../worker-health.server";
import prisma from "../../db.server";
import { createDefaultAIPlatform } from "../../ai/providers/index";

vi.mock("../cron-worker.server", () => ({
  getCronWorkerHealth: vi.fn(),
}));

vi.mock("../worker-health.server", () => ({
  getWorkerInfrastructureHealth: vi.fn(),
}));

vi.mock("../job.server", () => ({
  getJobQueueMetrics: vi.fn(),
}));

vi.mock("../startup-readiness.server", () => ({
  getStartupReadiness: vi.fn(),
}));

vi.mock("../../db.server", () => ({
  default: {
    $queryRaw: vi.fn(),
  },
  getDatabaseMetricsSnapshot: vi.fn(() => ({
    queryCount: 0,
    slowQueryCount: 0,
    retryCount: 0,
    transactionCount: 0,
    slowTransactionCount: 0,
    connectionWaitMs: 0,
    poolUtilizationEstimate: null,
    averageQueryDurationMs: 0,
    p95QueryDurationMs: 0,
    recentSlowQueries: [],
    recentSlowTransactions: [],
  })),
  auditDatabaseUrl: vi.fn(() => ({
    usesSupabasePooler: true,
    connectionLimit: 1,
    poolTimeoutSeconds: 15,
    pgbouncer: true,
    warnings: [],
    recommendations: [],
  })),
}));

vi.mock("../../ai/providers/index", () => ({
  createDefaultAIPlatform: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.AI_PROVIDER;
  delete process.env.AI_MODEL;
  delete process.env.OPENAI_API_KEY;
  process.env.DATABASE_URL = "postgresql://user:pass@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres";
  process.env.DIRECT_URL = "postgresql://user:pass@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres";
  process.env.SHOPIFY_API_KEY = "shopify-key";
  process.env.SHOPIFY_API_SECRET = "shopify-secret";
  process.env.SHOPIFY_APP_URL = "https://store-pilot.test";
  process.env.SCOPES = "read_products,read_inventory,write_products,read_orders";
  process.env.CRON_SECRET = "cron-secret";

  vi.mocked(getWorkerInfrastructureHealth).mockResolvedValue({
    ok: true,
    status: "healthy",
    executionMode: "serverless_cron",
    timestamp: new Date().toISOString(),
    queue: {
      queued: 0,
      claimed: 0,
      running: 0,
      deadLetter: 0,
      retrying: 0,
      failed: 0,
      cancelled: 0,
    },
    queueExtended: {
      queued: 0,
      claimed: 0,
      running: 0,
      deadLetter: 0,
      retrying: 0,
      failed: 0,
      cancelled: 0,
      queueDepth: 0,
      oldestQueuedJobAgeMs: null,
      longestQueuedJobId: null,
      averageWaitTimeMs: null,
      averageExecutionTimeMs: null,
      totalRetryCount: 0,
      throughputLastHour: 0,
      byJobType: {},
    },
    workers: {
      activeWorkers: 1,
      drainingWorkers: 0,
      staleWorkers: 0,
      workers: [],
    },
    runtime: null,
    processMetrics: {
      cyclesCompleted: 0,
      jobsProcessed: 0,
      jobsFailed: 0,
      lastCycleAt: null,
      lastJobAt: null,
      startedAt: new Date().toISOString(),
      uptimeMs: 0,
    },
    cron: {
      cronSecretConfigured: true,
      queueEnabled: true,
    },
    orphanJobs: [],
    alerts: [],
  });
});

describe("monitoring.server", () => {
  it("returns liveness without dependency checks", () => {
    const report = getLivenessReport();
    expect(report.ok).toBe(true);
    expect(report.mode).toBe("liveness");
  });

  it("returns readiness from startup checks", async () => {
    vi.mocked(getStartupReadiness).mockResolvedValue({
      ready: false,
      checks: [{ id: "cron_secret", ok: false, reason: "CRON_SECRET_missing" }],
    });

    const report = await getReadinessReport();
    expect(report.ok).toBe(false);
    expect(report.mode).toBe("readiness");
    expect(report.checks).toHaveLength(1);
  });

  it("checks database connectivity", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ ok: 1 }]);

    const check = await checkDatabaseHealth();
    expect(check.ok).toBe(true);
    expect(check.status).toBe("healthy");
    expect(check.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("checks supabase via prisma connectivity", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ ok: 1 }]);

    const check = await checkSupabaseHealth();
    expect(check.ok).toBe(true);
    expect(check.details?.hostLooksLikeSupabase).toBe(true);
  });

  it("checks shopify api configuration", () => {
    const check = checkShopifyApiHealth();
    expect(check.ok).toBe(true);
    expect(check.status).toBe("healthy");
  });

  it("reports cron health from cron worker config", () => {
    vi.mocked(getCronWorkerHealth).mockReturnValue({
      cronSecretConfigured: true,
      queueEnabled: true,
    });

    const check = checkCronHealth();
    expect(check.ok).toBe(true);
    expect(check.id).toBe("cron");
  });

  it("marks queue degraded when dead-letter jobs exist", async () => {
    vi.mocked(getJobQueueMetrics).mockResolvedValue({
      queued: 2,
      claimed: 0,
      running: 1,
      deadLetter: 3,
      retrying: 0,
      failed: 0,
      cancelled: 0,
    });

    const check = await checkQueueHealth();
    expect(check.status).toBe("degraded");
    expect(check.ok).toBe(true);
  });

  it("aggregates worker health from infrastructure checks", async () => {
    vi.mocked(getWorkerInfrastructureHealth).mockResolvedValue({
      ok: true,
      status: "healthy",
      executionMode: "serverless_cron",
      timestamp: new Date().toISOString(),
      queue: {
        queued: 0,
        claimed: 0,
        running: 0,
        deadLetter: 0,
        retrying: 0,
        failed: 0,
        cancelled: 0,
      },
      queueExtended: {
        queued: 0,
        claimed: 0,
        running: 0,
        deadLetter: 0,
        retrying: 0,
        failed: 0,
        cancelled: 0,
        queueDepth: 0,
        oldestQueuedJobAgeMs: null,
        longestQueuedJobId: null,
        averageWaitTimeMs: null,
        averageExecutionTimeMs: null,
        totalRetryCount: 0,
        throughputLastHour: 0,
        byJobType: {},
      },
      workers: {
        activeWorkers: 1,
        drainingWorkers: 0,
        staleWorkers: 0,
        workers: [],
      },
      runtime: null,
      processMetrics: {
        cyclesCompleted: 0,
        jobsProcessed: 0,
        jobsFailed: 0,
        lastCycleAt: null,
        lastJobAt: null,
        startedAt: new Date().toISOString(),
        uptimeMs: 0,
      },
      cron: {
        cronSecretConfigured: true,
        queueEnabled: true,
      },
      orphanJobs: [],
      alerts: [],
    });

    const check = await checkWorkerHealth();
    expect(check.ok).toBe(true);
    expect(check.status).toBe("healthy");
  });

  it("disables ai health when platform is not configured", async () => {
    const check = await checkAiHealth();
    expect(check.status).toBe("disabled");
    expect(check.ok).toBe(true);
  });

  it("probes ai provider when configured", async () => {
    process.env.AI_PROVIDER = "openai";
    process.env.AI_MODEL = "gpt-4o-mini";
    process.env.OPENAI_API_KEY = "test-openai-key";

    vi.mocked(createDefaultAIPlatform).mockReturnValue({
      config: {
        provider: "openai",
        model: "gpt-4o-mini",
        temperature: 0.2,
        maxTokens: 2048,
        structuredOutputEnabled: true,
        timeoutMs: 30000,
      },
      registry: {} as never,
      provider: {
        id: "openai",
        healthCheck: vi.fn(async () => ({
          provider: "openai",
          healthy: true,
          latencyMs: 12,
          message: "OpenAI provider reachable",
        })),
      } as never,
    });

    const check = await checkAiHealth();
    expect(check.ok).toBe(true);
    expect(check.status).toBe("healthy");
  });

  it("builds full monitoring report", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ ok: 1 }]);
    vi.mocked(getCronWorkerHealth).mockReturnValue({
      cronSecretConfigured: true,
      queueEnabled: true,
    });
    vi.mocked(getJobQueueMetrics).mockResolvedValue({
      queued: 0,
      claimed: 0,
      running: 0,
      deadLetter: 0,
      retrying: 0,
      failed: 0,
      cancelled: 0,
    });

    const report = await getMonitoringReport();
    expect(report.mode).toBe("monitor");
    expect(report.checks.map((check) => check.id)).toEqual([
      "database",
      "supabase",
      "shopify_api",
      "queue",
      "cron",
      "worker",
      "ai",
    ]);
    expect(report.ok).toBe(true);
  });
});
