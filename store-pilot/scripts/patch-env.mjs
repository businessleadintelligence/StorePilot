import { createHash, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const envPath = join(process.cwd(), ".env");
const vercelPath = join(process.cwd(), ".env.vercel");

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

const vercel = parseEnv(readFileSync(vercelPath, "utf8"));
const local = parseEnv(readFileSync(envPath, "utf8"));

const merged = new Map(local);
merged.set("DATABASE_URL", vercel.get("DATABASE_URL") ?? merged.get("DATABASE_URL") ?? "");
merged.set("DIRECT_URL", vercel.get("DIRECT_URL") ?? merged.get("DIRECT_URL") ?? "");
merged.set(
  "SCOPES",
  "read_products,read_inventory,write_products,read_orders",
);
merged.set("SHOPIFY_API_KEY", vercel.get("SHOPIFY_API_KEY") ?? merged.get("SHOPIFY_API_KEY") ?? "");
merged.set(
  "SHOPIFY_API_SECRET",
  vercel.get("SHOPIFY_API_SECRET") ?? merged.get("SHOPIFY_API_SECRET") ?? "",
);
merged.set("SHOPIFY_APP_URL", vercel.get("SHOPIFY_APP_URL") ?? merged.get("SHOPIFY_APP_URL") ?? "");

if (!merged.get("TOKEN_ENCRYPTION_KEY")) {
  merged.set("TOKEN_ENCRYPTION_KEY", randomBytes(32).toString("base64"));
}
if (!merged.get("CRON_SECRET")) {
  merged.set("CRON_SECRET", randomBytes(32).toString("hex"));
}

const openAi =
  merged.get("OPENAI_API_KEY") ??
  merged.get("OpenAI_API_Key") ??
  local.get("OpenAI_API_Key")?.trim();
if (openAi) {
  merged.set("OPENAI_API_KEY", openAi.replace(/^\s+/, ""));
}
merged.delete("OpenAI_API_Key");

merged.set("AI_PROVIDER", merged.get("AI_PROVIDER") ?? "openai");
merged.set("AI_MODEL", merged.get("AI_MODEL") ?? "gpt-4o-mini");

merged.delete("SUPABASE_URL");
merged.delete("SUPABASE_ANON_KEY");
merged.delete("SUPABASE_SERVICE_ROLE_KEY");

const lines = [
  "# StorePilot local environment (patched for infrastructure sprint)",
  `SHOPIFY_API_KEY=${merged.get("SHOPIFY_API_KEY")}`,
  `SHOPIFY_API_SECRET=${merged.get("SHOPIFY_API_SECRET")}`,
  `SCOPES=${merged.get("SCOPES")}`,
  `SHOPIFY_APP_URL=${merged.get("SHOPIFY_APP_URL")}`,
  "",
  `DATABASE_URL="${merged.get("DATABASE_URL")}"`,
  `DIRECT_URL="${merged.get("DIRECT_URL")}"`,
  "",
  `TOKEN_ENCRYPTION_KEY=${merged.get("TOKEN_ENCRYPTION_KEY")}`,
  `CRON_SECRET=${merged.get("CRON_SECRET")}`,
  "",
  `AI_PROVIDER=${merged.get("AI_PROVIDER")}`,
  `AI_MODEL=${merged.get("AI_MODEL")}`,
  `OPENAI_API_KEY=${merged.get("OPENAI_API_KEY") ?? ""}`,
  "",
];

writeFileSync(envPath, lines.join("\n"), "utf8");
console.log("patched .env (database synced from Vercel, scopes fixed, secrets ensured)");
