# Runtime Health Report — Phase C.1

**Date:** 2026-07-10T07:40Z  
**Method:** Live HTTP probes

---

## Endpoint Summary

| Endpoint | HTTP | Latency | ok |
|----------|------|---------|-----|
| /health | 200 | 2176ms | true |
| /health/live | 200 | 518ms | true |
| /health/ready | 503 | ~300ms | false |
| /health/worker | 503 | ~7300ms | false |
| /health/monitor | 503 | ~13500ms | false |

---

## Readiness Failures Explained

### 1. shopify_scope_drift

| Why | `shopify.app.toml` not on serverless filesystem at `/var/task` |
| Impact | False negative — scopes are aligned in repo |
| Fix | Skip toml read on Vercel OR bundle toml; compare env only |

### 2. migrations

| Why | `prisma/migrations` dir missing from `/var/task` |
| Impact | Readiness fails even if DB migrations applied |
| Fix | DB-only migration check when dir missing (partial code exists) |

### 3. foundation_prompt_registry

| Why | Prompt files not at `process.cwd()/app/ai/prompts` on Vercel |
| Impact | AI jobs may fail; readiness blocked |
| Fix | Align bundle path with validator |

---

## Monitor Subsystems

| Subsystem | Status | Evidence |
|-----------|--------|----------|
| Database | ✅ healthy | SELECT 1, ~737ms |
| Supabase | ✅ healthy | DIRECT_URL set |
| Shopify API config | ✅ healthy | Keys + scopes valid |
| Queue | ✅ healthy | Depth 0 (no active work) |
| Cron auth | ✅ healthy | CRON_SECRET set |
| Worker | ❌ unhealthy | no_active_workers |
| AI provider | ✅ healthy | OpenAI 527ms |

---

## Downstream Intelligence (Not independently probed)

| System | Health endpoint | Result |
|--------|-----------------|--------|
| Billing | /api/pricing | ✅ 200 |
| Knowledge graph | — | **Not Verified** (no data) |
| Learning | — | **Not Verified** |
| Prediction | — | **Not Verified** |
| Experiments | — | **Not Verified** |
| Merchant Intelligence | — | **Not Verified** |

All blocked by sync/worker failure.

---

## Pool Warnings (Verified via monitor)

- `connection_limit` query param missing
- `pool_timeout` query param missing
- Average query duration ~1947ms (elevated during health check itself)
