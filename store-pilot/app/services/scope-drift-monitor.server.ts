import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  parseConfiguredScopes,
  PROHIBITED_SHOPIFY_SCOPES,
  validateMinimumShopifyScopes,
} from "../lib/privacy-by-architecture";
import { SHOPIFY_APP_TOML_SCOPE_LIST } from "../lib/shopify-app-config";

export type ScopeDriftReport = {
  ok: boolean;
  envScopes: string[];
  configuredScopes: string[];
  prohibitedInEnv: string[];
  missingInEnv: string[];
  envDiffFromToml: string[];
  tomlDiffFromEnv: string[];
};

function readShopifyAppTomlScopes(): string[] {
  try {
    const tomlPath = join(process.cwd(), "shopify.app.toml");
    const contents = readFileSync(tomlPath, "utf8");
    const match = contents.match(/scopes\s*=\s*"([^"]+)"/);
    if (!match?.[1]) {
      return SHOPIFY_APP_TOML_SCOPE_LIST;
    }

    return parseConfiguredScopes(match[1]);
  } catch {
    return SHOPIFY_APP_TOML_SCOPE_LIST;
  }
}

export function detectShopifyScopeDrift(
  env: NodeJS.ProcessEnv = process.env,
): ScopeDriftReport {
  const envScopes = parseConfiguredScopes(env.SCOPES);
  const configuredScopes = readShopifyAppTomlScopes();
  const validation = validateMinimumShopifyScopes(env.SCOPES);

  const envSet = new Set(envScopes);
  const tomlSet = new Set(configuredScopes);

  const envDiffFromToml = envScopes.filter((scope) => !tomlSet.has(scope));
  const tomlDiffFromEnv = configuredScopes.filter((scope) => !envSet.has(scope));

  const prohibitedInEnv = envScopes.filter((scope) =>
    PROHIBITED_SHOPIFY_SCOPES.includes(
      scope as (typeof PROHIBITED_SHOPIFY_SCOPES)[number],
    ),
  );

  const ok =
    prohibitedInEnv.length === 0 &&
    validation.missingRequired.length === 0 &&
    envDiffFromToml.length === 0 &&
    tomlDiffFromEnv.length === 0;

  return {
    ok,
    envScopes,
    configuredScopes,
    prohibitedInEnv,
    missingInEnv: validation.missingRequired,
    envDiffFromToml,
    tomlDiffFromEnv,
  };
}

export function formatScopeDriftAlert(report: ScopeDriftReport): string {
  if (report.ok) {
    return "shopify_scope_drift:none";
  }

  const parts: string[] = [];

  if (report.prohibitedInEnv.length > 0) {
    parts.push(`prohibited:${report.prohibitedInEnv.join(",")}`);
  }

  if (report.missingInEnv.length > 0) {
    parts.push(`missing:${report.missingInEnv.join(",")}`);
  }

  if (report.envDiffFromToml.length > 0) {
    parts.push(`env_not_in_toml:${report.envDiffFromToml.join(",")}`);
  }

  if (report.tomlDiffFromEnv.length > 0) {
    parts.push(`toml_not_in_env:${report.tomlDiffFromEnv.join(",")}`);
  }

  return `shopify_scope_drift:${parts.join(";")}`;
}
