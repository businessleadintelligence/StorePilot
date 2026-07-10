import { readdirSync } from "node:fs";
import { join } from "node:path";

import { validateFoundationPromptRegistry } from "../ai/foundation/prompt-validation.server";
import { validateMinimumShopifyScopes } from "../lib/privacy-by-architecture";
import prisma from "../db.server";
import {
  encryptSecretToken,
  decryptSecretToken,
  isTokenEncryptionConfigured,
} from "./token-crypto.server";
import {
  detectShopifyScopeDrift,
  formatScopeDriftAlert,
} from "./scope-drift-monitor.server";
import { migratePlaintextSecretTokens } from "./token-migration.server";
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

function listExpectedMigrationNames(): string[] | null {
  try {
    const migrationsDir = join(process.cwd(), "prisma", "migrations");

    return readdirSync(migrationsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^\d+_/.test(entry.name))
      .map((entry) => entry.name)
      .sort();
  } catch {
    return null;
  }
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

  if (isTokenEncryptionConfigured()) {
    try {
      const roundTrip = decryptSecretToken(encryptSecretToken("startup_probe"));
      checks.push({
        id: "token_encryption_roundtrip",
        ok: roundTrip === "startup_probe",
        reason: roundTrip === "startup_probe" ? undefined : "token_encryption_roundtrip_failed",
      });
    } catch (error) {
      checks.push({
        id: "token_encryption_roundtrip",
        ok: false,
        reason:
          error instanceof Error ? error.message : "token_encryption_roundtrip_failed",
      });
    }
  } else {
    checks.push({
      id: "token_encryption_roundtrip",
      ok: env.NODE_ENV !== "production",
      reason:
        env.NODE_ENV === "production"
          ? "TOKEN_ENCRYPTION_KEY_missing"
          : undefined,
    });
  }

  const scopeDrift = detectShopifyScopeDrift(env);
  checks.push({
    id: "shopify_scope_drift",
    ok: scopeDrift.ok,
    reason: scopeDrift.ok ? undefined : formatScopeDriftAlert(scopeDrift),
  });

  try {
    const expectedMigrations = listExpectedMigrationNames();
    const appliedRows = await prisma.$queryRaw<Array<{ migration_name: string }>>`
      SELECT migration_name
      FROM "_prisma_migrations"
    `;
    const applied = new Set(appliedRows.map((row) => row.migration_name));

    if (expectedMigrations === null) {
      const onServerless = Boolean(env.VERCEL || env.AWS_LAMBDA_FUNCTION_NAME);
      checks.push({
        id: "migrations",
        ok: applied.size > 0,
        reason:
          applied.size > 0
            ? undefined
            : onServerless
              ? "migrations_missing:no_applied_migrations_in_database"
              : "migrations_missing:no_applied_migrations_in_database",
      });
    } else {
      const missing = expectedMigrations.filter((name) => !applied.has(name));

      checks.push({
        id: "migrations",
        ok: missing.length === 0,
        reason:
          missing.length === 0 ? undefined : `migrations_missing:${missing.join(",")}`,
      });
    }
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

  const promptValidation = validateFoundationPromptRegistry();
  checks.push({
    id: "foundation_prompt_registry",
    ok: promptValidation.ok,
    reason:
      promptValidation.ok
        ? undefined
        : `missing_prompts:${promptValidation.missingPromptIds.join(",")}`,
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
  if (isTokenEncryptionConfigured()) {
    await migratePlaintextSecretTokens().catch(() => undefined);
  }

  const readiness = await getStartupReadiness(env);
  if (!readiness.ready) {
    throw new StartupReadinessError(
      readiness.checks.filter((check) => !check.ok).map((check) => check.id),
    );
  }

  return readiness;
}
