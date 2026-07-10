# P0 Production Incident — Fresh Merchant Install Crash

**Incident ID:** P0-INSTALL-20260710  
**Severity:** P0 — merchant cannot use app after install  
**Status:** Root cause identified; fix implemented; **MV-1 revalidation pending**  
**Production URL:** https://store-pilot-eta.vercel.app  
**Commit under investigation:** `fc584bab06ee60d66666193fc4ea41807359d148`  
**Incident store (from logs):** `varsha-cf8clnuz.myshopify.com`

---

## Summary

After OAuth completes on a brand-new Shopify development store, opening the embedded app shows:

- **Something went wrong**
- **Unexpected Server Error**
- **Return to StorePilot**

Merchants sometimes briefly see **`accounts.shopify.com refused to connect`** before the server error.

Production health endpoints (`/health`, `/health/ready`, `/health/worker`, `/health/monitor`) remain green. This is **not** a build/lint/test failure — it is a **runtime SSR failure on first dashboard load**.

---

## Reproduction (confirmed in production)

| Step | Result |
|------|--------|
| Create new Shopify development store | ✅ |
| Install StorePilot from Partner Dashboard | ✅ |
| OAuth completes | ✅ |
| Open embedded `/app` | ❌ **Unexpected Server Error** |

**Evidence timestamps (UTC, Vercel logs):**

| Time (UTC) | Route | HTTP | Shop |
|------------|-------|------|------|
| 2026-07-10 23:07:49 | `GET /` → 302 | 302 | varsha-cf8clnuz.myshopify.com |
| 2026-07-10 23:07:50 | `GET /app` | 200 (SSR error) | varsha-cf8clnuz.myshopify.com |
| 2026-07-10 23:07:59 | `GET /app` | 200 (SSR error) | varsha-cf8clnuz.myshopify.com |
| 2026-07-10 23:06:28 | `GET /app/coo` | 500 | varsha-cf8clnuz.myshopify.com |

Note: HTTP **200** on `/app` despite error — Shopify App Bridge `boundary.error()` surfaces SSR abort as **Unexpected Server Error** in the embedded iframe.

---

## Phase 1 — Exception captured

See [STACK_TRACE_ANALYSIS.md](./STACK_TRACE_ANALYSIS.md) for full Vercel stack traces.

**Primary exception (GET /app):**

```
Error: The render was aborted by the server without a reason.
    at cd (.../react-dom/cjs/react-dom-server.node.production.min.js:83:268)
    at .../react-dom-server.node.production.min.js:98:303
    at Set.forEach (<anonymous>)
    at ld (.../react-dom-server.node.production.min.js:98:276)
    at Timeout.abort [as _onTimeout] (.../react-dom-server.node.production.min.js:102:385)
    at listOnTimeout (node:internal/timers:605:17)
    at process.processTimers (node:internal/timers:541:7)
```

**Secondary exception (GET /app/coo):**

```
PrismaClientKnownRequestError: Invalid `prisma.webhookEvent.count()` invocation:
Timed out fetching a new connection from the connection pool.
(Current connection pool timeout: 15, connection limit: 1)
  code: 'P2024'
```

---

## Impact

- **100% of fresh installs** that hit heavy dashboard SSR path are affected when DB pool is contended.
- Existing merchants navigating client-side (`GET /app.data`) may succeed while full document load fails.
- COO dashboard (`/app/coo`) can 500 under same pool exhaustion.

---

## Related documents

| Document | Purpose |
|----------|---------|
| [ROOT_CAUSE_ANALYSIS.md](./ROOT_CAUSE_ANALYSIS.md) | Causal chain and contributing factors |
| [STACK_TRACE_ANALYSIS.md](./STACK_TRACE_ANALYSIS.md) | Full Vercel logs and stack traces |
| [FIX_IMPLEMENTATION.md](./FIX_IMPLEMENTATION.md) | Targeted fix (no speculative refactor) |
| [REGRESSION_REPORT.md](./REGRESSION_REPORT.md) | Automated test evidence |
| [MV1_REVALIDATION.md](./MV1_REVALIDATION.md) | Manual fresh-install checklist (pending) |
| [FINAL_PRODUCTION_INCIDENT_REPORT.md](./FINAL_PRODUCTION_INCIDENT_REPORT.md) | Certification gate |

---

## Certification gate

**Do not mark resolved until:**

1. A **new** Shopify development store installs successfully end-to-end.
2. Merchant reaches `/app` dashboard with **no Unexpected Server Error**.
3. No `accounts.shopify.com refused to connect` during the happy path.
4. MV-1 timestamps recorded in [MV1_REVALIDATION.md](./MV1_REVALIDATION.md).
