# 12 — Performance Certification

**Date:** 2026-07-10  
**Status:** 🔴 **NOT VERIFIED**

## Measurements required (not executed)

| Surface | P50 | P95 | P99 | Status |
|---------|-----|-----|-----|--------|
| Dashboard loader | — | — | — | NOT VERIFIED |
| Executive / COO | — | — | — | NOT VERIFIED |
| Knowledge Graph | — | — | — | NOT VERIFIED |
| Cold start (Vercel) | — | — | — | NOT VERIFIED |
| Worker job latency | — | — | — | NOT VERIFIED |

## Observed (C.1 production)

| Endpoint | Latency note |
|----------|--------------|
| `/health/worker` | ~7s (C.1 doc) — indicates cold start / DB pressure |

## Bundle sizes (local build)

| Asset | Size |
|-------|------|
| server-build.js | ~2,547 KB |
| server-build.css | ~35 KB |

## Required human action

Run load tests or manual timing post-deploy:

```bash
# Example
for i in 1 2 3; do curl -w "%{time_total}\n" -o /dev/null -s https://store-pilot-eta.vercel.app/health; done
```

Use Vercel Analytics / Supabase metrics for sustained measurement.

## Certification result

**NOT CERTIFIED**
