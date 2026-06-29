import { readdirSync } from "node:fs";
import { join } from "node:path";

import { validateMinimumShopifyScopes } from "../lib/privacy-by-architecture";
import prisma from "../db.server";
import { getCronWorkerHealth } from "./cron-worker.server";

export type StartupReadinessCheck = {
  id: string;
  ok: boolean;
  reason?: string;
};

export type StartupReadiness = {
  ready: boolean;
  checks: StartupReadinessCheck[];
};

export class StartupReadinessError extends Error {
  readonly failedChecks: string[];

  constructor(failedChecks: string[]) {
    super(`startup_readiness_failed:${failedChecks.join(",")}`);
    this.name = "StartupReadinessError";
    this.failedChecks = failedChecks;
  }
}

function listExpectedMigrationNames(): string[] {
  const migrationsDir = join(process.cwd(), "prisma", "migrations");

  return readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d+_/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

export async function getStartupReadiness(
  env: NodeJS.ProcessEnv = process.env,
): Promise<StartupReadiness> {
  const checks: StartupReadinessCheck[] = [];

  const cronHealth = getCronWorkerHealth(env);
  checks.push({
    id: "cron_secret",
    ok: cronHealth.cronSecretConfigured,
    reason: cronHealth.reason,
  });

  checks.push({
    id: "worker_queue",
    ok: cronHealth.queueEnabled,
    reason: cronHealth.queueEnabled ? undefined : "worker_queue_disabled",
  });

  checks.push({
    id: "shopify_api_secret",
    ok: Boolean(env.SHOPIFY_API_SECRET?.trim()),
    reason: env.SHOPIFY_API_SECRET?.trim() ? undefined : "SHOPIFY_API_SECRET_missing",
  });

  const scopeValidation = validateMinimumShopifyScopes(env.SCOPES);
  checks.push({
    id: "shopify_scopes",
    ok: scopeValidation.prohibited.length === 0 && scopeValidation.missingRequired.length === 0,
    reason:
      scopeValidation.prohibited.length > 0
        ? `prohibited_scopes:${scopeValidation.prohibited.join(",")}`
        : scopeValidation.missingRequired.length > 0
          ? `missing_scopes:${scopeValidation.missingRequired.join(",")}`
          : undefined,
  });

  checks.push({
    id: "shopify_api_key",
    ok: Boolean(env.SHOPIFY_API_KEY?.trim()),
    reason: env.SHOPIFY_API_KEY?.trim() ? undefined : "SHOPIFY_API_KEY_missing",
  });

  checks.push({
    id: "database_url",
    ok: Boolean(env.DATABASE_URL?.trim()),
    reason: env.DATABASE_URL?.trim() ? undefined : "DATABASE_URL_missing",
  });

  checks.push({
    id: "token_encryption_key",
    ok: Boolean(env.TOKEN_ENCRYPTION_KEY?.trim()),
    reason: env.TOKEN_ENCRYPTION_KEY?.trim()
      ? undefined
      : "TOKEN_ENCRYPTION_KEY_missing",
  });

  try {
    const expectedMigrations = listExpectedMigrationNames();
    const appliedRows = await prisma.$queryRaw<Array<{ migration_name: string }>>`
      SELECT migration_name
      FROM "_prisma_migrations"
    `;
    const applied = new Set(appliedRows.map((row) => row.migration_name));
    const missing = expectedMigrations.filter((name) => !applied.has(name));

    checks.push({
      id: "migrations",
      ok: missing.length === 0,
      reason:
        missing.length === 0 ? undefined : `migrations_missing:${missing.join(",")}`,
    });
  } catch (error) {
    checks.push({
      id: "migrations",
      ok: false,
      reason:
        error instanceof Error ? error.message : "migration_check_failed",
    });
  }

  checks.push({
    id: "webhook_registration_config",
    ok: Boolean(env.SHOPIFY_APP_URL?.trim() && env.SHOPIFY_API_SECRET?.trim()),
    reason:
      env.SHOPIFY_APP_URL?.trim() && env.SHOPIFY_API_SECRET?.trim()
        ? undefined
        : "webhook_registration_config_incomplete",
  });

  const ready = checks.every((check) => check.ok);

  return { ready, checks };
}

export function getStartupHealthIndicator(
  readiness: StartupReadiness,
): "green" | "red" {
  return readiness.ready ? "green" : "red";
}

export async function assertStartupReadiness(
  env: NodeJS.ProcessEnv = process.env,
): Promise<StartupReadiness> {
  const readiness = await getStartupReadiness(env);
  if (!readiness.ready) {
    throw new StartupReadinessError(
      readiness.checks.filter((check) => !check.ok).map((check) => check.id),
    );
  }

  return readiness;
}
