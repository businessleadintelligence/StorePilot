import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const envPath = join(process.cwd(), ".env");

function parseEnv(content) {
  const map = new Map();
  for (const line of content.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    map.set(key, value);
  }
  return map;
}

const env = parseEnv(readFileSync(envPath, "utf8"));

const targets = [
  { key: "DATABASE_URL", environments: ["production", "preview", "development"] },
  { key: "DIRECT_URL", environments: ["production", "preview", "development"] },
  { key: "SCOPES", environments: ["production", "preview", "development"] },
  { key: "TOKEN_ENCRYPTION_KEY", environments: ["production", "preview", "development"] },
  { key: "CRON_SECRET", environments: ["production", "preview", "development"] },
  { key: "AI_PROVIDER", environments: ["production", "preview", "development"] },
  { key: "AI_MODEL", environments: ["production", "preview", "development"] },
  { key: "OPENAI_API_KEY", environments: ["production", "preview", "development"] },
];

function run(cmd, args, input) {
  const result = spawnSync(cmd, args, {
    cwd: process.cwd(),
    input,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    shell: process.platform === "win32",
  });
  return result;
}

for (const { key, environments } of targets) {
  const value = env.get(key);
  if (!value) {
    console.log(`skip ${key} (missing in .env)`);
    continue;
  }

  for (const environment of environments) {
    run("vercel", ["env", "rm", key, environment, "--yes"], undefined);
    const add = run("vercel", ["env", "add", key, environment], `${value}\n`);
    if (add.status !== 0) {
      console.error(`failed ${key} ${environment}: ${add.stderr || add.stdout}`);
      process.exitCode = 1;
    } else {
      console.log(`set ${key} (${environment})`);
    }
  }
}

console.log("vercel env sync complete");
