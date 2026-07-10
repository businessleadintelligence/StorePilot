# Stack Trace Analysis — P0 Install Crash

**Source:** Vercel Production runtime logs (`store-pilot-eta.vercel.app`)  
**Captured:** 2026-07-10 ~23:07 UTC (17:37 IST)  
**Command:** `vercel logs store-pilot-eta.vercel.app --level error --since 3h --expand`

Raw JSON export: [`_vercel_error_logs.jsonl`](./_vercel_error_logs.jsonl)

---

## Request 1 — Primary incident (fresh install dashboard)

| Field | Value |
|-------|-------|
| **Timestamp** | 2026-07-10 23:07:59.28 UTC |
| **Host** | store-pilot-eta.vercel.app |
| **Method / Route** | `GET /app` |
| **HTTP Status** | 200 (SSR aborted; error boundary shown to merchant) |
| **Function** | λ serverless |
| **Shop** | `varsha-cf8clnuz.myshopify.com` |
| **Exception type** | `Error` (React DOM server SSR abort) |
| **Exception message** | `The render was aborted by the server without a reason.` |

### Pre-exception log sequence (same request)

```
[shopify-app/INFO] Authenticating admin request | {shop: varsha-cf8clnuz.myshopify.com}
[shopify-app/INFO] Authenticating admin request | {shop: varsha-cf8clnuz.myshopify.com}
[db-slow-query] { model: 'Session', operation: 'findUnique', durationMs: 13387 }
[db-slow-query] { model: 'Session', operation: 'findUnique', durationMs: 13388 }
[db-slow-query] { model: 'Store', operation: 'findUnique', durationMs: 1469 }
[db-slow-query] { model: 'Product', operation: 'count', durationMs: 731 }
[db-slow-query] { model: 'StoreOnboarding', operation: 'findUnique', durationMs: 1462 }
[db-slow-query] { model: 'StoreOnboarding', operation: 'findUnique', durationMs: 2193 }
[db-slow-query] { model: 'StoreMetricsCache', operation: 'findUnique', durationMs: 2925 }
[db-slow-query] { model: 'Order', operation: 'count', durationMs: 3656 }
[db-slow-query] { model: 'Store', operation: 'findUnique', durationMs: 4387 }
[db-slow-query] { model: 'LearningVelocity', operation: 'findMany', durationMs: 733 }
[db-slow-query] { model: 'QuickWin', operation: 'findMany', durationMs: 1466 }
[db-slow-query] { model: 'Experiment', operation: 'findMany', durationMs: 2196 }
[db-slow-query] { model: 'ExecutiveDecision', operation: 'findMany', durationMs: 2928 }
[db-slow-query] { model: 'ExperimentRecommendation', operation: 'findMany', durationMs: 3811 }
[db-slow-query] { model: 'RootCause', operation: 'findMany', durationMs: 4542 }
[db-slow-query] { model: 'MerchantTimeline', operation: 'findMany', durationMs: 5273 }
[db-slow-query] { model: 'RootCause', operation: 'findMany', durationMs: 6005 }
```

### Full stack trace

```
Error: The render was aborted by the server without a reason.
    at cd (/var/task/store-pilot/node_modules/react-dom/cjs/react-dom-server.node.production.min.js:83:268)
    at /var/task/store-pilot/node_modules/react-dom/cjs/react-dom-server.node.production.min.js:98:303
    at Set.forEach (<anonymous>)
    at ld (/var/task/store-pilot/node_modules/react-dom/cjs/react-dom-server.node.production.min.js:98:276)
    at Timeout.abort [as _onTimeout] (/var/task/store-pilot/node_modules/react-dom/cjs/react-dom-server.node.production.min.js:102:385)
    at listOnTimeout (node:internal/timers:605:17)
    at process.processTimers (node:internal/timers:541:7)
```

(Repeated 5× in same request — one per Suspense boundary awaiting unresolved loader promises.)

### Interpretation

- **Route:** `app/routes/app._index.tsx` (dashboard index under `app/routes/app.tsx` layout)
- **Loader:** `app._index.tsx` `loader()` — returned unresolved Promises for intelligence sections while SSR attempted to stream them via `<Suspense>` / `<Await>`
- **Failure point:** React DOM server **abort timer** — SSR exceeded allowed render window while waiting on DB-backed promises
- **Not a thrown business-logic exception** — timeout/abort during streaming render

---

## Request 2 — Retry (same merchant, 9s earlier)

| Field | Value |
|-------|-------|
| **Timestamp** | 2026-07-10 23:07:50.10 UTC |
| **Route** | `GET /app` |
| **Shop** | `varsha-cf8clnuz.myshopify.com` |
| **Exception** | Same SSR abort |

Notable slow query before abort:

```
[db-slow-query] { model: 'WebhookEvent', operation: 'count', durationMs: 79220 }
```

79s query indicates severe pool/DB contention on cold fresh install.

---

## Request 3 — Secondary failure (COO dashboard)

| Field | Value |
|-------|-------|
| **Timestamp** | 2026-07-10 23:06:28.08 UTC |
| **Route** | `GET /app/coo` |
| **HTTP Status** | 500 |
| **Shop** | `varsha-cf8clnuz.myshopify.com` |
| **Exception type** | `PrismaClientKnownRequestError` |
| **Prisma code** | `P2024` |
| **Model** | `WebhookEvent` |
| **Operation** | `count()` |

### Full stack trace

```
PrismaClientKnownRequestError:
  Invalid `prisma.webhookEvent.count()` invocation:
  Timed out fetching a new connection from the connection pool.
  More info: http://pris.ly/d/connection-pool
  (Current connection pool timeout: 15, connection limit: 1)
    at ei.handleRequestError (.../@prisma/client/runtime/library.js:121:7268)
    at ei.handleAndLogRequestError (.../@prisma/client/runtime/library.js:121:6593)
    at ei.request (.../@prisma/client/runtime/library.js:121:6300)
    at async Array.$allOperations (.../server-build-KjGZh_cv.js:264:20)
    at async a (.../@prisma/client/runtime/library.js:130:9551)
    at async Promise.all (index 2)
    at async monitorWebhooks (.../server-build-KjGZh_cv.js:58866:68)
    at async Promise.all (index 4)
    at async runProductionHealthEngine (.../server-build-KjGZh_cv.js:58940:7)
    at async getProductionHealthDashboard (.../server-build-KjGZh_cv.js:58998:20)
```

Followed by:

```
[Error: Unexpected Server Error]
[Error: Unexpected Server Error]
```

### Interpretation

- **Route:** COO dashboard loader calling `getProductionHealthDashboard`
- **Service:** `monitorWebhooks` → parallel Prisma counts with `connection_limit=1`
- Same pool exhaustion class as dashboard incident, different entry point

---

## Merchant-visible error mapping

| User sees | Source |
|-----------|--------|
| **Unexpected Server Error** | `app/routes/app.tsx` → `boundary.error(useRouteError())` |
| **Something went wrong** | `app/root.tsx` ErrorBoundary fallback |
| **Return to StorePilot** | `app/root.tsx` L64 |

---

## Contrast — successful client data request

| Timestamp | Route | Status |
|-----------|-------|--------|
| 23:09:18 | `GET /app.data` | 200 (slow queries, no SSR abort) |

Client `.data` requests complete without React SSR abort timer — confirms failure is **document SSR path**, not inability to serve data entirely.
