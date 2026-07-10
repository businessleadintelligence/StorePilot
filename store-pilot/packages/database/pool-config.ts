export type DatabasePoolRecommendation = {
  runtime: "vercel_serverless" | "background_worker" | "ai_platform";
  connectionLimit: number;
  poolTimeoutSeconds: number;
  pgbouncer: boolean;
  notes: string[];
};

export type DatabaseUrlAudit = {
  usesSupabasePooler: boolean;
  connectionLimit: number | null;
  poolTimeoutSeconds: number | null;
  pgbouncer: boolean;
  warnings: string[];
  recommendations: DatabasePoolRecommendation[];
};

const SERVERLESS_POOL: DatabasePoolRecommendation = {
  runtime: "vercel_serverless",
  connectionLimit: 1,
  poolTimeoutSeconds: 15,
  pgbouncer: true,
  notes: [
    "One connection per warm serverless isolate.",
    "Use Supabase transaction pooler (port 6543) with pgbouncer=true.",
  ],
};

const WORKER_POOL: DatabasePoolRecommendation = {
  runtime: "background_worker",
  connectionLimit: 3,
  poolTimeoutSeconds: 30,
  pgbouncer: true,
  notes: [
    "Worker cron may claim jobs while webhooks run concurrently.",
    "Keep total app connections below Supabase plan limit.",
  ],
};

const AI_PLATFORM_POOL: DatabasePoolRecommendation = {
  runtime: "ai_platform",
  connectionLimit: 2,
  poolTimeoutSeconds: 20,
  pgbouncer: true,
  notes: [
    "AI agent runs should enqueue DB writes; avoid long-held connections during LLM calls.",
    "Prefer batch reads + in-memory mapping over per-row queries.",
  ],
};

export function getDatabasePoolRecommendations(): DatabasePoolRecommendation[] {
  return [SERVERLESS_POOL, WORKER_POOL, AI_PLATFORM_POOL];
}

export function auditDatabaseUrl(
  databaseUrl: string | undefined = process.env.DATABASE_URL,
): DatabaseUrlAudit {
  const warnings: string[] = [];

  if (!databaseUrl?.trim()) {
    return {
      usesSupabasePooler: false,
      connectionLimit: null,
      poolTimeoutSeconds: null,
      pgbouncer: false,
      warnings: ["DATABASE_URL is not configured"],
      recommendations: getDatabasePoolRecommendations(),
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    return {
      usesSupabasePooler: false,
      connectionLimit: null,
      poolTimeoutSeconds: null,
      pgbouncer: false,
      warnings: ["DATABASE_URL is not a valid URL"],
      recommendations: getDatabasePoolRecommendations(),
    };
  }

  const usesSupabasePooler =
    parsed.hostname.includes("pooler.supabase.com") || parsed.port === "6543";

  const connectionLimit = parseIntParam(parsed.searchParams.get("connection_limit"));
  const poolTimeoutSeconds = parseIntParam(parsed.searchParams.get("pool_timeout"));
  const pgbouncer =
    parsed.searchParams.get("pgbouncer") === "true" ||
    parsed.searchParams.get("pgbouncer") === "1";

  if (usesSupabasePooler && !pgbouncer) {
    warnings.push("Supabase pooler URL detected without pgbouncer=true");
  }

  if (connectionLimit === null) {
    warnings.push(
      "connection_limit query param missing; Prisma defaults may exceed serverless-safe limits",
    );
  } else if (connectionLimit > 1 && process.env.VERCEL === "1") {
    warnings.push(
      `connection_limit=${connectionLimit} is high for Vercel serverless; recommend 1`,
    );
  }

  if (poolTimeoutSeconds === null) {
    warnings.push("pool_timeout query param missing; default may be too low under load");
  }

  return {
    usesSupabasePooler,
    connectionLimit,
    poolTimeoutSeconds,
    pgbouncer,
    warnings,
    recommendations: getDatabasePoolRecommendations(),
  };
}

function parseIntParam(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}
