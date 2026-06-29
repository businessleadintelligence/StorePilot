import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const FACTS_LAYER_ROOT = join(process.cwd(), "app", "ai", "facts");

export const FORBIDDEN_FACTS_CONNECTOR_IMPORT_PATTERNS = [
  /connectors\/google\/ga4/i,
  /connectors\/google\/search-console/i,
  /connectors\/google\/pagespeed/i,
  /connectors\/microsoft\/clarity/i,
  /google\/analytics/i,
  /google\/search-console/i,
  /google\/pagespeed/i,
  /microsoft\/clarity/i,
  /syncStoreConnectors/i,
  /fetchGa4/i,
  /fetchGsc/i,
  /fetchPageSpeed/i,
  /fetchClarity/i,
  /google-integration\.server/i,
  /clarity-integration\.server/i,
] as const;

function collectTypeScriptFiles(directory: string): string[] {
  const entries = readdirSync(directory);
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(directory, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      files.push(...collectTypeScriptFiles(fullPath));
      continue;
    }

    if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      files.push(fullPath);
    }
  }

  return files;
}

export function scanFactsLayerForForbiddenConnectorImports(
  rootDirectory = FACTS_LAYER_ROOT,
): Array<{ file: string; pattern: string }> {
  const violations: Array<{ file: string; pattern: string }> = [];

  for (const filePath of collectTypeScriptFiles(rootDirectory)) {
    const contents = readFileSync(filePath, "utf8");

    for (const pattern of FORBIDDEN_FACTS_CONNECTOR_IMPORT_PATTERNS) {
      if (pattern.test(contents)) {
        violations.push({
          file: relative(process.cwd(), filePath),
          pattern: pattern.source,
        });
      }
    }
  }

  return violations;
}

export function enforceFactsLayerConnectorIsolation(rootDirectory = FACTS_LAYER_ROOT): void {
  const violations = scanFactsLayerForForbiddenConnectorImports(rootDirectory);
  if (violations.length === 0) return;

  const details = violations.map((violation) => `${violation.file} matched ${violation.pattern}`).join("\n");
  throw new Error(`Facts layer attempted to access connector modules directly:\n${details}`);
}
