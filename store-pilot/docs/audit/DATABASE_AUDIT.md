# Database Architecture Audit — StorePilot Phase A

**Date:** 2026-07-10  
**Schema:** `prisma/schema.prisma` (~3,000 lines, 112 models, 103 indexes)

---

## Executive Summary

The database schema is **comprehensive and well-indexed** for a multi-tenant SaaS intelligence platform. Primary concerns:

1. **Schema size** — 112 models increases migration complexity and GDPR deletion surface
2. **`onDelete: Restrict`** on most Store relations — requires explicit deletion ordering
3. **Incomplete shop redact** — `deleteShopDataByDomain()` deletes ~19 table types, omits intelligence pipeline tables
4. **JSON columns** — widespread `Json`/`JsonB` fields without DB-level PII constraints

---

## Schema Statistics

| Metric | Value |
|--------|-------|
| Models | 112 |
| Indexes (`@@index`) | 103 |
| Enums | 30+ |
| Migrations | 36 |
| UUID primary keys | Yes (`gen_random_uuid()`) |
| Multi-tenant key | `storeId` on virtually all business tables |

---

## Index Coverage

**Strengths:**
- Claim index on `sync_jobs`: `[status, availableAt, priority]` — optimized for worker polling
- Stale lock index: `[status, lockExpiresAt]`
- Store-scoped indexes on products, orders, webhooks
- Unique constraints on idempotency keys (`sync_jobs.idempotencyKey`, webhook IDs)

**Index Recommendation Report:**

| Table | Recommended Index | Rationale |
|-------|-------------------|-----------|
| `knowledgeGraphNode` | `[storeId, nodeType, updatedAt]` | Collection/product graph queries filter by type |
| `decisionJournal` | `[storeId, createdAt DESC]` | Timeline queries (may exist — verify) |
| `merchantTimeline` | `[storeId, occurredAt DESC]` | Unified timeline workspace |
| `experiment` | `[storeId, status, rankScore]` | Dashboard filtering by status |
| `prediction` | `[storeId, predictionType, active]` | Domain workspace filters |
| JSON-heavy tables | Functional indexes on hot JSON keys | Only if query plans show seq scans |

Run `EXPLAIN ANALYZE` on production-like data before adding indexes.

---

## Foreign Keys & Cascades

Most intelligence tables use `onDelete: Restrict` on `Store` FK — **correct for data integrity** but requires complete deletion logic in GDPR handlers.

**Gap:** `deleteShopDataByDomain()` in `app/services/gdpr.server.ts:272-291` deletes:
- AI tables (recommendations, results, cache, agent runs, memory)
- Integrations, onboarding, jobs, orders, products, webhooks, billing, users, store

**NOT deleted (examples):**
- `Evidence`, `KnowledgeGraphNode`, `KnowledgeGraphEdge`
- `HistoricalMemory`, `PatternSeed`, `ConfidenceSeed`
- `ExecutiveDecision`, `RootCause`, `Prediction`, `Experiment`
- `DecisionJournal`, `AdaptiveScore`, `BusinessDnaVersion`
- All merchant intelligence tables (18+)

**Risk:** `tx.store.delete()` will **fail with FK violation** if intelligence pipeline has run.

---

## JSON Columns

| Usage | Models | Risk |
|-------|--------|------|
| Evidence/context payloads | Evidence, AiAgentRun, engine outputs | PII drift if guards fail |
| Causal chains | RootCause.causalChain, timeline | Low PII risk |
| Graph metadata | KnowledgeGraphNode.metadata | Low risk |
| Job payloads | SyncJob.payload | Could capture webhook fragments |

**Mitigation exists:** `app/lib/privacy-by-architecture.ts` — runtime guards, not DB constraints.

---

## Transaction Usage

Transactions used appropriately in:
- Job lifecycle (`job.server.ts` — 12+ transaction blocks)
- Engine upserts (prediction, experiment, root-cause, merchant-intelligence)
- Order/product sync batches (`orders.server.ts`, `product.server.ts`)
- GDPR shop redact (single mega-transaction — **timeout risk** on large stores)

**Concern:** GDPR shop redact uses one transaction for all deletes. Documented in `docs/DATABASE_SCALABILITY_REPORT.md` as timeout risk.

---

## Connection Pooling

**Implementation:** `packages/database/client.ts`
- Instrumented Prisma client with query timing
- Pool config audit via `auditDatabaseUrl()` in `packages/database/pool-config.ts`
- Graceful disconnect on SIGINT/SIGTERM
- Optional `PRISMA_LOG_QUERIES=1` for debug

**Recommendation:** Verify `connection_limit` and `pool_timeout` in production `DATABASE_URL` for Vercel + worker concurrency.

---

## Multi-Tenant Safety

| Control | Status |
|---------|--------|
| All queries scoped by `storeId` | Enforced in services — manual discipline |
| No PostgreSQL RLS | Application-level isolation only |
| Session storage encrypted | `EncryptedPrismaSessionStorage` |
| Cross-store data leak tests | Privacy tests exist |

**Recommendation:** Add integration tests asserting cross-store query isolation for intelligence APIs.

---

## Migration History

36 migrations from bootstrap through merchant intelligence platform. Recent:
- `20260710040000_merchant_intelligence_platform`
- `20260710030000_experiment_intelligence_platform`
- `20260710020000_prediction_prevention_engine`

**Risk:** Long migration chains slow fresh deploys. Consider squashing for new environments post-launch.

---

## Soft Delete Consistency

No universal soft delete pattern. Engines use `active: Boolean` flags on predictions, root causes, experiments. Orders/products use hard delete on shop redact.

**Recommendation:** Document active-flag convention; avoid mixing soft/hard delete for same entity type.

---

## Partition Candidates

| Table | Candidate | Rationale |
|-------|-----------|-----------|
| `order` | By `metricDate` or `storeId` | Grows with sync volume |
| `jobEvent` | By `createdAt` | Audit trail growth |
| `aiAgentRun` | By `createdAt` | Telemetry volume |
| `webhookEvent` | By `createdAt` | High write rate |

Not required at current scale; plan for 10K+ stores.
