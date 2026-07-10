# Database Contention Report — P0 Stabilization

---

## Production symptoms

```
Transaction API error: Unable to start a transaction in the given time.
PrismaClientKnownRequestError P2024: Timed out fetching a new connection from the connection pool
Store.findUnique durationMs: ~15000
```

---

## Root cause analysis

### Primary: connection pool saturation

Production `DATABASE_URL` uses:

- `pgbouncer=true`
- `connection_limit=1`
- `pool_timeout=15`

Each Vercel serverless invocation gets **one** Prisma connection. When many concurrent requests run (fresh install webhook burst + dashboard loaders + cron worker), queries **queue** for the single slot.

**15,000 ms `Store.findUnique` is predominantly wait time**, not query execution — consistent with pool queueing under load.

### Secondary: transaction fan-out on webhook burst

Each `products/create` webhook (transactional path):

1. Outer `prisma.$transaction` wrapping all variant writes
2. Per new variant: `assertProductCreateAllowedAtomic` → 2× `FOR UPDATE` + `count` + `create`

A single product with N variants holds one transaction open across N billing checks.

### Tertiary: failed SQL aborting transactions

Before `store_id` fix, subscription lock threw immediately, failing the whole webhook transaction and causing Shopify retries → **more concurrent pressure**.

---

## Concurrent pressure sources (fresh install)

| Source | Concurrent ops |
|--------|----------------|
| PRODUCT_CREATE webhooks (Shopify burst) | 10–100+ invocations |
| Dashboard `/app` + `/app.data` | 2–10+ invocations |
| `onboarding_bootstrap` worker | 1 job, many queries |
| Cron `/cron/worker` | Every 2 min |
| Post-auth webhook registration | Shopify API + DB |

All compete for **1 connection** per instance.

---

## Nested / long transactions (audit)

| Location | Keeps tx open during | Risk |
|----------|---------------------|------|
| `upsertProductFromWebhookPayload` | All variant upserts | High on multi-variant products |
| `assertProductCreateAllowedAtomic` | Inside caller tx | Required for TOCTOU |
| `claimNextJob` + follow-up event tx | Separate txs | Medium |
| `runProductionHealthEngine` | Was 13 parallel — **fixed sequential** | Reduced |

**No transactions kept open during Shopify API calls inside billing enforcement** — verified.

---

## Fixes applied (this sprint + prior)

| Fix | Impact on contention |
|-----|-------------------|
| `store_id` → `"storeId"` | Stops immediate tx abort / retry storm |
| Dashboard SSR intelligence guard | Reduces parallel loader queries |
| Production health sequential monitors | Reduces parallel subsystem queries |
| COO: cached health badge only | Removes 13-query engine from COO path |

---

## Recommendations (not all implemented)

1. **Enqueue product webhook processing** — return 200 after claim (see WEBHOOK_BURST_PROTECTION.md)
2. **Consider `connection_limit=2`** for serverless if Supabase plan allows — trade-off documented in POOL_CONFIGURATION_AUDIT.md
3. **Short-circuit billing lock** when subscription row missing on fresh trial (optional optimization)

---

## Verification status

| Check | Status |
|-------|--------|
| No transaction timeout during fresh install | **NOT VERIFIED** — requires post-deploy MV-1 |
| store_id SQL errors eliminated | ✅ Verified by code fix + test |
