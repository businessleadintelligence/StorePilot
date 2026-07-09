import { loadAIConfig } from "../ai/core/ai-config";
import { createDefaultAIPlatform } from "../ai/providers/index";
import { validateMinimumShopifyScopes } from "../lib/privacy-by-architecture";
import prisma from "../db.server";
import { getCronWorkerHealth } from "./cron-worker.server";
import { getJobQueueMetrics, type JobQueueMetrics } from "./job.server";
import { getStartupReadiness, type StartupReadiness } from "./startup-readiness.server";

export type MonitorStatus = "healthy" | "degraded" | "unhealthy" | "disabled" | "unknown";

export type MonitorCheck = {
  id: string;
  status: MonitorStatus;
  ok: boolean;
  message?: string;
  latencyMs?: number;
  details?: Record<string, unknown>;
};

export type MonitoringReport = {
  ok: boolean;
  service: "store-pilot";
  mode: "monitor";
  timestamp: string;
  checks: MonitorCheck[];
};

export type LivenessReport = {
  ok: true;
  service: "store-pilot";
  mode: "liveness";
  timestamp: string;
};

export type ReadinessReport = {
  ok: boolean;
  service: "store-pilot";
  mode: "readiness";
  timestamp: string;
  checks: StartupReadiness["checks"];
};

const AI_HEALTH_TIMEOUT_MS = 5_000;

function createCheck(
  id: string,
  status: MonitorStatus,
  input: Omit<MonitorCheck, "id" | "status" | "ok"> & { ok?: boolean },
): MonitorCheck {
  const ok =
    input.ok ??
    (status === "healthy" || status === "disabled");

  return {
    id,
    status,
    ok,
    ...(input.message ? { message: input.message } : {}),
    ...(input.latencyMs !== undefined ? { latencyMs: input.latencyMs } : {}),
    ...(input.details ? { details: input.details } : {}),
  };
}

export function getLivenessReport(): LivenessReport {
  return {
    ok: true,
    service: "store-pilot",
    mode: "liveness",
    timestamp: new Date().toISOString(),
  };
}

export async function getReadinessReport(
  env: NodeJS.ProcessEnv = process.env,
): Promise<ReadinessReport> {
  const readiness = await getStartupReadiness(env);

  return {
    ok: readiness.ready,
    service: "store-pilot",
    mode: "readiness",
    timestamp: new Date().toISOString(),
    checks: readiness.checks,
  };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error("health_check_timeout"));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export async function checkDatabaseHealth(): Promise<MonitorCheck> {
  const startedAt = Date.now();

  try {
    const rows = await prisma.$queryRaw<Array<{ ok: number }>>`SELECT 1 as ok`;
    const latencyMs = Date.now() - startedAt;

    return createCheck("database", "healthy", {
      ok: true,
      latencyMs,
      message: "PostgreSQL reachable",
      details: {
        probe: "select_1",
        result: rows[0]?.ok ?? null,
      },
    });
  } catch (error) {
    return createCheck("database", "unhealthy", {
      ok: false,
      latencyMs: Date.now() - startedAt,
      message: error instanceof Error ? error.message : "database_unreachable",
    });
  }
}

export async function checkSupabaseHealth(
  env: NodeJS.ProcessEnv = process.env,
): Promise<MonitorCheck> {
  const databaseUrlConfigured = Boolean(env.DATABASE_URL?.trim());
  const directUrlConfigured = Boolean(env.DIRECT_URL?.trim());
  const databaseUrl = env.DATABASE_URL ?? "";
  const hostLooksLikeSupabase =
    databaseUrl.includes("supabase.com") || databaseUrl.includes("pooler.supabase.com");

  if (!databaseUrlConfigured) {
    return createCheck("supabase", "unhealthy", {
      ok: false,
      message: "DATABASE_URL_missing",
      details: {
        databaseUrlConfigured,
        directUrlConfigured,
      },
    });
  }

  const database = await checkDatabaseHealth();
  if (!database.ok) {
    return createCheck("supabase", "unhealthy", {
      ok: false,
      latencyMs: database.latencyMs,
      message: "Supabase PostgreSQL unreachable via Prisma",
      details: {
        databaseUrlConfigured,
        directUrlConfigured,
        hostLooksLikeSupabase,
        database,
      },
    });
  }

  return createCheck("supabase", directUrlConfigured ? "healthy" : "degraded", {
    ok: true,
    latencyMs: database.latencyMs,
    message: directUrlConfigured
      ? "Supabase PostgreSQL reachable"
      : "Supabase PostgreSQL reachable; DIRECT_URL not configured",
    details: {
      databaseUrlConfigured,
      directUrlConfigured,
      hostLooksLikeSupabase,
      accessMode: "prisma",
    },
  });
}

export function checkShopifyApiHealth(
  env: NodeJS.ProcessEnv = process.env,
): MonitorCheck {
  const apiKeyConfigured = Boolean(env.SHOPIFY_API_KEY?.trim());
  const apiSecretConfigured = Boolean(env.SHOPIFY_API_SECRET?.trim());
  const appUrlConfigured = Boolean(env.SHOPIFY_APP_URL?.trim());
  const scopeValidation = validateMinimumShopifyScopes(env.SCOPES);

  const issues: string[] = [];
  if (!apiKeyConfigured) issues.push("SHOPIFY_API_KEY_missing");
  if (!apiSecretConfigured) issues.push("SHOPIFY_API_SECRET_missing");
  if (!appUrlConfigured) issues.push("SHOPIFY_APP_URL_missing");
  if (scopeValidation.missingRequired.length > 0) {
    issues.push(`missing_scopes:${scopeValidation.missingRequired.join(",")}`);
  }
  if (scopeValidation.prohibited.length > 0) {
    issues.push(`prohibited_scopes:${scopeValidation.prohibited.join(",")}`);
  }

  if (issues.length === 0) {
    return createCheck("shopify_api", "healthy", {
      ok: true,
      message: "Shopify API configuration valid",
      details: {
        apiKeyConfigured,
        apiSecretConfigured,
        appUrlConfigured,
        scopesValid: true,
        probe: "configuration",
      },
    });
  }

  return createCheck("shopify_api", "unhealthy", {
    ok: false,
    message: issues.join("; "),
    details: {
      apiKeyConfigured,
      apiSecretConfigured,
      appUrlConfigured,
      issues,
      probe: "configuration",
    },
  });
}

export function checkCronHealth(
  env: NodeJS.ProcessEnv = process.env,
): MonitorCheck {
  const health = getCronWorkerHealth(env);

  if (!health.cronSecretConfigured) {
    return createCheck("cron", "unhealthy", {
      ok: false,
      message: health.reason ?? "CRON_SECRET_missing",
      details: health,
    });
  }

  return createCheck("cron", "healthy", {
    ok: true,
    message: "Cron worker authentication configured",
    details: health,
  });
}

export async function checkQueueHealth(): Promise<MonitorCheck> {
  try {
    const metrics = await getJobQueueMetrics();
    const status = resolveQueueStatus(metrics);

    return createCheck("queue", status, {
      ok: status !== "unhealthy",
      message: describeQueueHealth(metrics, status),
      details: metrics,
    });
  } catch (error) {
    return createCheck("queue", "unhealthy", {
      ok: false,
      message: error instanceof Error ? error.message : "queue_metrics_unavailable",
    });
  }
}

export async function checkWorkerHealth(
  env: NodeJS.ProcessEnv = process.env,
): Promise<MonitorCheck> {
  const cron = checkCronHealth(env);
  let queue: MonitorCheck;

  try {
    queue = await checkQueueHealth();
  } catch (error) {
    queue = createCheck("queue", "unhealthy", {
      ok: false,
      message: error instanceof Error ? error.message : "queue_metrics_unavailable",
    });
  }

  const ok = cron.ok && queue.ok;
  const status: MonitorStatus =
    !cron.ok || queue.status === "unhealthy"
      ? "unhealthy"
      : queue.status === "degraded"
        ? "degraded"
        : "healthy";

  return createCheck("worker", status, {
    ok,
    message: ok
      ? "Worker queue operational"
      : "Worker queue requires attention",
    details: {
      cron,
      queue: queue.details ?? {},
    },
  });
}

export async function checkAiHealth(
  env: NodeJS.ProcessEnv = process.env,
): Promise<MonitorCheck> {
  const provider = env.AI_PROVIDER?.trim();
  const model = env.AI_MODEL?.trim();
  const openAiKey = env.OPENAI_API_KEY?.trim();

  if (!provider || !model) {
    return createCheck("ai", "disabled", {
      ok: true,
      message: "AI platform not configured",
      details: {
        configured: false,
        provider: provider ?? null,
        model: model ?? null,
      },
    });
  }

  if (provider === "openai" && !openAiKey) {
    return createCheck("ai", "unhealthy", {
      ok: false,
      message: "OPENAI_API_KEY_missing",
      details: {
        configured: true,
        provider,
        model,
      },
    });
  }

  try {
    loadAIConfig({
      provider,
      model,
      temperature: env.AI_TEMPERATURE,
      maxTokens: env.AI_MAX_TOKENS,
      structuredOutputEnabled: env.AI_STRUCTURED_OUTPUT_ENABLED,
      timeoutMs: env.AI_TIMEOUT_MS,
    });
  } catch (error) {
    return createCheck("ai", "unhealthy", {
      ok: false,
      message: error instanceof Error ? error.message : "ai_configuration_invalid",
      details: { provider, model },
    });
  }

  try {
    const platform = createDefaultAIPlatform({ env });
    const result = await withTimeout(
      platform.provider.healthCheck(),
      AI_HEALTH_TIMEOUT_MS,
    );

    return createCheck("ai", result.healthy ? "healthy" : "degraded", {
      ok: result.healthy,
      latencyMs: result.latencyMs,
      message: result.message ?? (result.healthy ? "AI provider reachable" : "AI provider degraded"),
      details: {
        configured: true,
        provider: result.provider,
        model,
        probe: "provider_health_check",
      },
    });
  } catch (error) {
    return createCheck("ai", "degraded", {
      ok: false,
      message: error instanceof Error ? error.message : "ai_health_probe_failed",
      details: {
        configured: true,
        provider,
        model,
        probe: "provider_health_check",
      },
    });
  }
}

export async function getMonitoringReport(
  env: NodeJS.ProcessEnv = process.env,
): Promise<MonitoringReport> {
  const [
    database,
    supabase,
    shopifyApi,
    queue,
    cron,
    worker,
    ai,
  ] = await Promise.all([
    checkDatabaseHealth(),
    checkSupabaseHealth(env),
    Promise.resolve(checkShopifyApiHealth(env)),
    checkQueueHealth(),
    Promise.resolve(checkCronHealth(env)),
    checkWorkerHealth(env),
    checkAiHealth(env),
  ]);

  const checks = [database, supabase, shopifyApi, queue, cron, worker, ai];
  const blockingChecks = checks.filter(
    (check) => check.status !== "disabled" && !check.ok,
  );

  return {
    ok: blockingChecks.length === 0,
    service: "store-pilot",
    mode: "monitor",
    timestamp: new Date().toISOString(),
    checks,
  };
}

function resolveQueueStatus(metrics: JobQueueMetrics): MonitorStatus {
  if (metrics.deadLetter > 0) {
    return "degraded";
  }

  return "healthy";
}

function describeQueueHealth(metrics: JobQueueMetrics, status: MonitorStatus): string {
  if (status === "degraded") {
    return `Queue has ${metrics.deadLetter} dead-letter job(s)`;
  }

  return "Job queue operational";
}
