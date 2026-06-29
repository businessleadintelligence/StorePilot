import { getStartupReadiness } from "../services/startup-readiness.server";
import { buildSubsystemHealth } from "./production-checks";
import type { ProductionSubsystemHealth } from "./production-types";

export async function monitorSecurityHealth(): Promise<ProductionSubsystemHealth> {
  const readiness = await getStartupReadiness();
  const failedChecks = readiness.checks.filter((check) => !check.ok);

  return buildSubsystemHealth({
    id: "security",
    label: "Security",
    level: readiness.ready ? "healthy" : failedChecks.length <= 2 ? "warning" : "critical",
    failureCount: failedChecks.length,
    lastError: failedChecks[0]?.reason ?? null,
    recoverySuggestion: readiness.ready
      ? null
      : "Resolve startup readiness checks and verify secrets configuration",
    details: Object.fromEntries(
      readiness.checks.map((check) => [check.id, check.ok ? "ok" : check.reason ?? "failed"]),
    ),
  });
}

export function validateProductionEnvironment(env: NodeJS.ProcessEnv = process.env): {
  ok: boolean;
  missing: string[];
} {
  const required = [
    "SHOPIFY_API_KEY",
    "SHOPIFY_API_SECRET",
    "DATABASE_URL",
    "TOKEN_ENCRYPTION_KEY",
  ];
  const missing = required.filter((key) => !env[key]?.trim());
  return { ok: missing.length === 0, missing };
}
