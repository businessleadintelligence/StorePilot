# Pool Configuration Audit — P0 Stabilization

---

## Expected production configuration

From `scripts/ops/patch-database-url-pool.mjs` and deployment runbook:

| Parameter | Expected value | Purpose |
|-----------|----------------|---------|
| `pgbouncer` | `true` | Supabase pooler mode |
| `connection_limit` | `1` | Serverless-safe single connection per instance |
| `pool_timeout` | `15` | Max seconds to wait for pool slot |

---

## Verification

| Method | Result |
|--------|--------|
| `/health/ready` | ✅ 200 — `database_url` check passes |
| Prior Vercel deploy | Pool params applied via CLI |
| Prisma error messages in logs | Confirm `connection_limit: 1, timeout: 15` |

**Direct read of Vercel env vars:** Not performed in this audit (requires dashboard/CLI secrets access). Configuration inferred from:

1. Production Prisma P2024 errors citing `connection_limit: 1`
2. Prior sprint documentation (`patch-database-url-pool.mjs`)
3. `/health/ready` database connectivity OK

---

## Are values actually used?

**Yes** — Prisma client reads `DATABASE_URL` at runtime. Error metadata from production:

```
(Current connection pool timeout: 15, connection limit: 1)
```

---

## Trade-offs

| Setting | Benefit | Cost |
|---------|---------|------|
| `connection_limit=1` | Prevents Supabase pool exhaustion on serverless | Serializes all parallel Prisma ops → queue waits |
| `pool_timeout=15` | Fails fast vs hanging | 503/tx errors under burst |
| `pgbouncer=true` | Transaction pooling for serverless | Requires quoted identifiers in raw SQL |

---

## Interaction with this sprint's bugs

The `store_id` SQL error caused **immediate transaction failure**, triggering Shopify webhook retries. Each retry consumed another pool slot wait → amplified 15s `Store.findUnique` symptoms.

Fixing SQL does not increase pool size but **reduces retry storm**.

---

## Recommendations

1. Keep `connection_limit=1` until webhook processing is enqueued (reduces concurrent tx pressure)
2. If bursts persist after SQL fix, evaluate `connection_limit=2` with load testing
3. Never remove `pgbouncer=true` on Vercel without direct URL fallback plan

---

## DIRECT_URL

Used for migrations (`prisma migrate deploy`). Not validated on runtime path in this audit.

**Status:** Assumed configured if `/health/ready` migrations check passes.
