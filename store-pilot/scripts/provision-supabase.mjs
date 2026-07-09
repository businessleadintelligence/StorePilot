#!/usr/bin/env node
/**
 * Provision a fresh Supabase Postgres database for StorePilot.
 *
 * Prerequisites:
 *   1. Run `npx supabase login` in an interactive terminal, OR
 *   2. Set SUPABASE_ACCESS_TOKEN from https://supabase.com/dashboard/account/tokens
 *
 * Usage:
 *   node scripts/provision-supabase.mjs
 *   node scripts/provision-supabase.mjs --region ap-southeast-2 --name storepilot-prod
 *
 * After success, update Vercel:
 *   node scripts/sync-vercel-env.mjs   # syncs TOKEN_ENCRYPTION_KEY, CRON_SECRET, etc.
 *   vercel env add DATABASE_URL production
 *   vercel env add DIRECT_URL production
 *   npx prisma migrate deploy
 */

import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const region =
  args.includes("--region") ? args[args.indexOf("--region") + 1] : "ap-southeast-2";
const name =
  args.includes("--name") ? args[args.indexOf("--name") + 1] : `storepilot-${Date.now()}`;

function run(cmd, cmdArgs) {
  const result = spawnSync(cmd, cmdArgs, {
    encoding: "utf8",
    stdio: ["inherit", "pipe", "pipe"],
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    console.error(result.stderr || result.stdout);
    process.exit(result.status ?? 1);
  }

  return result.stdout;
}

console.log(`Creating Supabase project "${name}" in ${region}...`);

const createOutput = run("npx", [
  "supabase",
  "projects",
  "create",
  name,
  "--org-id",
  "auto",
  "--region",
  region,
  "--db-password",
  `StorePilot${Date.now()}DB`,
  "--output",
  "json",
]);

const project = JSON.parse(createOutput);
const ref = project.id ?? project.ref;

if (!ref) {
  console.error("Could not parse project ref from Supabase CLI output");
  process.exit(1);
}

console.log(`Project ref: ${ref}`);
console.log("Waiting for database to become ready...");

run("npx", ["supabase", "projects", "wait", ref]);

const dbUrl = run("npx", [
  "supabase",
  "projects",
  "api-keys",
  "--project-ref",
  ref,
  "--output",
  "json",
]);

const keys = JSON.parse(dbUrl);
const passwordNote =
  "Retrieve DATABASE_URL and DIRECT_URL from Supabase Dashboard → Project Settings → Database → Connection string (pooler + direct).";

const instructions = [
  "# Supabase provisioning result",
  "",
  `Project ref: ${ref}`,
  `Region: ${region}`,
  "",
  passwordNote,
  "",
  "Then run:",
  "  npx prisma migrate deploy",
  "  vercel env add DATABASE_URL production",
  "  vercel env add DIRECT_URL production",
  "",
  JSON.stringify({ ref, region, keys: keys?.length ?? 0 }, null, 2),
].join("\n");

const outPath = join(process.cwd(), "supabase-provision-result.txt");
writeFileSync(outPath, instructions, "utf8");
console.log(`Wrote ${outPath}`);
console.log("Next: copy connection strings into .env, run prisma migrate deploy, sync Vercel env.");
