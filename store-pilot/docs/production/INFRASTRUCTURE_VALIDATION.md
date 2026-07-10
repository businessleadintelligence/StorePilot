# Infrastructure Validation — Phase C

**Date:** 2026-07-10  
**Production:** Vercel (Hobby tier inferred) + Supabase PostgreSQL

---

## Database Connections

| Metric | Value | Source |
|--------|-------|--------|
| Reachability | ✅ Healthy | `/health/monitor` |
| Latency (SELECT 1) | ~752ms | Monitor 2026-07-10 |
| Pooler | pgbouncer=true | Monitor details |
| connection_limit param | ❌ Missing | Pool audit warning |
| pool_timeout param | ❌ Missing | Pool audit warning |
| Slow queries | ⚠️ 171/171 flagged slow | Monitor snapshot during health check |
| Avg query duration | ~1259ms | Monitor |
| P95 query duration | ~2484ms | Monitor |

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Location** | DATABASE_URL connection string |
| **Root Cause** | Missing `connection_limit=1` and `pool_timeout` for serverless |
| **Evidence** | Monitor poolAudit warnings |
| **Risk** | Connection exhaustion under load |
| **Recommended Fix** | Add pooler params per `.env.example` guidance |
| **Estimated Fix Time** | 30 min |
| **Owner** | DevOps |
| **Verification** | poolAudit warnings cleared |

---

## Memory & Cold Start

| Check | Result |
|-------|--------|
| Cold start measured | ❌ Not benchmarked |
| Vercel function memory config | ❌ Not in repo |
| Max duration config | ❌ Not in repo |

**Inference:** Health probe cold start ~6–19s total for sequential endpoints (includes network).

---

## Bundle Size

| Check | Result |
|-------|--------|
| Build output analyzed | ❌ Not in Phase C |
| Prompt copy step | ✅ In build script |
| prisma/migrations in bundle | ❌ Absent (readiness failure) |
| shopify.app.toml in bundle | ❌ Absent (scope drift false positive) |

---

## API Latency (Live Samples)

| Endpoint | Status | Approx latency |
|----------|--------|----------------|
| /health | 200 | ~2s (incl. cold) |
| /health/ready | 503 | ~7s |
| /health/worker | 503 | ~7s |
| /health/monitor | 503 | ~18s |
| /api/pricing | 200 | ~3s |

---

## Worker Latency

| Metric | Value |
|--------|-------|
| Jobs processed last hour | 0 |
| Average execution time | null |
| Queue depth | 0 |

---

## Queue Depth

Current: **0 queued** — stale state after cancelled jobs; not indicative of healthy throughput.

---

## CPU / Error Rate

| Check | Result |
|-------|--------|
| Vercel analytics | ❌ Not accessed |
| Error rate | ❌ Not measured |
| Retry rate | 0 (no job activity) |

---

## Shopify API Usage

| Check | Result |
|-------|--------|
| Rate limit handling | ✅ Code in sync services |
| Live API calls | ❌ 0 products synced — no usage observed |

---

## AI Latency

Provider health probe: **527ms** (OpenAI) — healthy.

---

## Deployment Topology

```
Shopify Merchant
    → Vercel (SSR app + daily cron)
    → Supabase PostgreSQL
    → [MISSING] Railway Worker (continuous)
    → OpenAI API
```

| Field | Value |
|-------|-------|
| **Severity** | Critical |
| **Location** | Architecture deployment |
| **Root Cause** | Worker tier not deployed |
| **Evidence** | health/worker |
| **Risk** | Async processing non-functional |
| **Recommended Fix** | Deploy worker service |
| **Estimated Fix Time** | 2–4 hours |
| **Owner** | DevOps |

---

## Test Suite (Quality Signal)

- **3033 tests passed** / 280 files (2026-07-10)
- Typecheck: pre-existing failures in `intelligence-workspace-views.tsx` (not production route blocker for core install path)

**Conclusion:** Infrastructure **partially provisioned**; **worker tier and serverless bundle gaps block launch**.
