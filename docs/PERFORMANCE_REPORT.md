# StorePilot — Performance Report

**Date:** 2026-07-09  
**Type:** Static analysis + architecture review (no load testing)

---

## Summary

StorePilot is a server-rendered Shopify embedded app with background job processing. No critical performance blockers were found in code review. Several optimization opportunities are documented below.

---

## Bundle analysis

| Metric | Value | Source |
|--------|-------|--------|
| Client modules | 415 | `npm run build` |
| Server modules | 596 | `npm run build` |
| Server bundle size | ~1.88 MB | build output |
| Largest client chunk | 140 KB (entry.client) | build output |

**Observation:** Server bundle includes full AI platform + Prisma + Shopify SDK. Expected for monolithic SSR deployment on Vercel.

### Recommendations

| Priority | Item |
|----------|------|
| Medium | Monitor serverless cold start latency on Vercel (large SSR bundle) |
| Low | React Router v8 code splitting flags available but not enabled |
| Low | Empty client chunks for API-only routes (webhooks, cron) — expected |

---

## Database / Prisma

| Pattern | Status | Notes |
|---------|--------|-------|
| N+1 in dashboard loaders | **Review** | `app._index.tsx` loader runs multiple parallel service calls — acceptable pattern |
| Raw SQL for job claiming | **Good** | `FOR UPDATE SKIP LOCKED` in worker |
| Missing indexes | **Good** | Schema has composite indexes on hot paths |
| Transaction usage | **Good** | GDPR shop redact uses `$transaction` |

### Recommendations

| Priority | Item |
|----------|------|
| Medium | Add query timing to monitoring for slow dashboard loaders |
| Low | Review `getExecutiveDashboard` for redundant Prisma calls |

---

## React / SSR

| Pattern | Status |
|---------|--------|
| Streaming SSR | Enabled via `@vercel/react-router` |
| Deferred data | Not widely used |
| Error boundaries | `boundary.error` on `app.tsx` |
| Unnecessary re-renders | Polaris web components — minimal React state |

---

## Background jobs

| Pattern | Status |
|---------|--------|
| Worker cron | Every 2 minutes |
| Job batching | `CRON_STORE_BATCH_SIZE` (default 50) |
| Stale lock release | Every 5 minutes |
| AI job execution | Enqueued, not blocking cron |

---

## External API rate limiting

| Integration | Pattern |
|-------------|---------|
| Google APIs | In-memory 60 req/min per instance |
| Shopify GraphQL | 429 retry with backoff |
| HTTP ingress | **None** — see SECURITY_REPORT.md |

---

## AI platform

| Pattern | Status |
|---------|--------|
| Result caching | `AiResultCacheEntry` + fingerprint |
| Token cost tracking | `estimatedCostUsd` on runs |
| Timeout | `AI_TIMEOUT_MS` (default 30s) |
| Retry | Platform retry with `retryCount` |

---

## Identified hotspots (recommendations only)

1. **Dashboard loader** — 8+ service calls per `/app` load; consider consolidating or caching metrics.
2. **Operations learning** — In-memory persistence; not a perf issue but not shared across instances.
3. **Google rate limiter** — In-memory per serverless instance; ineffective across Vercel instances.
4. **Full test suite** — ~52s for 2864 tests; acceptable for CI.

No code changes made — recommendations only per sprint scope.
