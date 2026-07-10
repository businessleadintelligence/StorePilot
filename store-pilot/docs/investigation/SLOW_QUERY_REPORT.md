# Slow Query Report — P0 Stabilization

---

## Reported slow query

```
[db-slow-query] { model: 'Store', operation: 'findUnique', durationMs: 15007 }
```

Also observed:

```
[db-slow-query] { model: 'Session', operation: 'findUnique', durationMs: 13387 }
[db-slow-query] { model: 'WebhookEvent', operation: 'count', durationMs: 79220 }
```

---

## Classification

| Symptom | Likely cause | Evidence |
|---------|--------------|----------|
| Store.findUnique 15s | **Connection pool wait** | `connection_limit=1`, concurrent webhook burst |
| Session.findUnique 13s | **Connection pool wait** | Same request as dashboard SSR abort |
| WebhookEvent.count 79s | **Pool wait + lock contention** | Occurred during COO/health parallel load |

These are **not** missing-index problems on `Store.id` (primary key lookup).

---

## Instrumentation in codebase

| Mechanism | Location |
|-----------|----------|
| `[db-slow-query]` logging | Prisma middleware / extension |
| `[route-loader]` timing | `app/lib/route-loader-log.server.ts` |
| `[after-auth]` / `[post-auth-bootstrap]` | Auth hooks |
| `[product-webhook]` / `[webhook-event]` | Webhook handlers |

---

## Dashboard loader timing (Phase 6 profile)

See `DASHBOARD_PERFORMANCE_PROFILE.md` for per-section breakdown.

**Key finding:** Pre-fix document SSR fired 7 intelligence loaders in parallel → 15+ queries competing for 1 connection → abort at ~10s SSR timeout.

---

## Before / after (document SSR path)

| Metric | Before (fc584ba) | After (c12318d + this sprint) |
|--------|------------------|-------------------------------|
| Intelligence DB calls on `GET /app` | 7+ parallel | **0** (deferred to `.data`) |
| SSR abort on fresh install | Yes (verified logs) | **NOT VERIFIED** post-latest deploy |
| Billing SQL error on webhook | Yes (`store_id`) | **Fixed** in code |

---

## Recommendations

1. Monitor `[db-slow-query]` after `store_id` fix — expect P95 drop for webhook path
2. If Store.findUnique still >1s under idle load → investigate Supabase region latency
3. Do not add indexes on `stores.id` — unnecessary

---

## Verification

Post-deploy fresh install with Vercel `--expand` logs required to confirm slow query resolution.

**Status:** **NOT VERIFIED** in production after `store_id` fix deploy.
