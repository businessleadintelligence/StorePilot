#!/usr/bin/env node
/**
 * Ensures Supabase pooler params on DATABASE_URL for Vercel serverless.
 * Usage: node scripts/ops/patch-database-url-pool.mjs [--print-only]
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const printOnly = process.argv.includes("--print-only");

function loadDatabaseUrl() {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) {
    throw new Error(".env not found");
  }
  const content = readFileSync(envPath, "utf8");
  const match = content.match(/^DATABASE_URL=(.+)$/m);
  if (!match) {
    throw new Error("DATABASE_URL not found in .env");
  }
  let value = match[1].trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return value;
}

function patchPoolParams(databaseUrl) {
  const url = new URL(databaseUrl);
  if (!url.searchParams.has("pgbouncer")) {
    url.searchParams.set("pgbouncer", "true");
  }
  url.searchParams.set("connection_limit", "1");
  url.searchParams.set("pool_timeout", "15");
  return url.toString();
}

const patched = patchPoolParams(loadDatabaseUrl());

if (printOnly) {
  console.log(patched);
  process.exit(0);
}

console.log(JSON.stringify({ patched: true, length: patched.length }));
