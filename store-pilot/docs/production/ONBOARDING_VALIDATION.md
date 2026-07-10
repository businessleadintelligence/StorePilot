# Onboarding Validation — Phase C

**Date:** 2026-07-10  
**Status:** ❌ **FAILED** — production onboarding does not complete automatically.

---

## Expected Flow

```
Install → OAuth → Store + Org + Billing → advanceOnboarding()
  → bootstrap_products (33%)
  → bootstrap_inventory (66%)
  → orders_historical (90%)
  → completed (100%)
  → intelligence pipeline (knowledge → graph → learning → quick wins → executive → …)
```

**Entry:** `app/shopify.server.ts` `afterAuth` → `getOrCreateStoreOnboarding()` → `advanceOnboarding()`  
**Progress config:** `app/services/onboarding.server.ts` — `PHASE_CONFIG`

---

## Progress Milestone Verification

| % | Label | Trigger | Verified in prod? |
|---|-------|---------|-------------------|
| 0% | Not started | Before `advanceOnboarding` | ⚠️ Not re-tested on fresh install |
| 10% | — | **Not implemented** — jumps to 33% | N/A (no 10% milestone in code) |
| **33%** | Syncing products | `enqueueAndLinkPhaseJob(PRODUCTS)` | ✅ **Observed stuck here** |
| 50% | — | **Not implemented** | N/A |
| **66%** | Syncing inventory | Products phase complete | ❌ Never reached in prod audit |
| **75%** | — | **Not implemented** | N/A |
| **90%** | Syncing orders | Inventory complete | ❌ Not reached |
| **100%** | Onboarding complete | All phases done | ❌ Not reached |

**Finding:** User-requested milestones 10%, 50%, 75% do not exist in code. Actual milestones are **33 / 66 / 90 / 100**.

---

## Root Cause: Stops at 33%

| Field | Value |
|-------|-------|
| **Severity** | Critical |
| **Location** | Job execution infra + `onboarding.server.ts:598-608` |
| **Root Cause** | (1) Worker never claims `bootstrap_products`; (2) progress written at enqueue, not at worker start |
| **Evidence** | `docs/BOOTSTRAP_SYNC_AUDIT.md`: job `queued`, `attempts: 0`, `progressPercent: 33`, `productSyncStatus: running`, 0 products in DB |
| **Risk** | All new merchants appear syncing forever |
| **Recommended Fix** | Deploy worker + fix cron; optional: set `running` only after `markPhaseStarted` |
| **Estimated Fix Time** | 2–4h (worker) + 4h (UX, optional) |
| **Owner** | Platform |
| **Verification** | Fresh install → 100% within SLA without manual SQL/cron |

---

## Phase Transition Matrix

| Transition | Job type | Auto? | Prod status |
|------------|----------|-------|-------------|
| OAuth → store created | afterAuth | ✅ Code path exists | ✅ (per audit) |
| Store → onboarding row | `getOrCreateStoreOnboarding` | ✅ | ✅ |
| Onboarding → bootstrap_products queued | `advanceOnboarding` | ✅ | ✅ Job enqueued |
| bootstrap_products → running | `claimNextJob` | ✅ Code | ❌ **Never claimed** |
| products → inventory | `finalizeSuccessfulJobPhase` | ✅ Code | ❌ Blocked |
| inventory → orders | same | ✅ Code | ❌ Blocked |
| orders → complete | same | ✅ Code | ❌ Blocked |
| complete → knowledge_ingest | worker chain | ✅ Code | ❌ Blocked |

---

## Intelligence Pipeline (Post-Sync)

Chained via `app/services/worker.server.ts` + `pipeline-chain.server.ts`:

| Stage | JobType | Depends on |
|-------|---------|------------|
| Knowledge | `knowledge_ingest` | Sync complete |
| Graph | `knowledge_graph_build` | Knowledge |
| Historical | `historical_intelligence` | Graph |
| Quick wins | `quick_wins_generate` | Historical |
| Executive | `executive_decision_generate` | Quick wins |
| Root cause | `root_cause_generate` | Pipeline chain |
| Prediction | `prediction_generate` | Pipeline chain |
| Experiments | `experiment_generate` | Pipeline chain |
| Executive COO | `executive_coo_generate` | Pipeline chain |
| Merchant intel | `merchant_intelligence_refresh` | COO |

**Prod status:** ❌ **Not verified** — blocked by sync never completing.

**Note:** `learning_bootstrap` also runs synchronously in `afterAuth` via `bootstrapIntelligenceAfterAuth()` — partial intelligence may initialize even when sync jobs stall.

---

## Frontend vs Backend

| Symptom | Type | Evidence |
|---------|------|----------|
| 33% stuck | **Worker/infra** (primary) | Queued job, no worker |
| "Running" while queued | **Progress calculation** | Enqueue sets `running` + 33% |
| SyncStatusCard shows 58% | **Frontend inconsistency** | Hardcoded `setupProgress` in `SyncStatusCard.tsx`, not DB `progressPercent` |

---

## Issue: Display "Running" When Queued

| Field | Value |
|-------|-------|
| **Severity** | High |
| **Location** | `enqueueAndLinkPhaseJob` sets `productSyncStatus: running` before worker claims |
| **Root Cause** | Status conflates "job created" with "sync in progress" |
| **Evidence** | Audit: `productSyncStatus: running` + job `status: queued` |
| **Risk** | Violates requirement: "Never display running when jobs are still queued" |
| **Recommended Fix** | Use `queued` phase status until `markPhaseStarted`; UI maps queued→"Waiting for worker" |
| **Estimated Fix Time** | 4 hours |
| **Owner** | Backend + Frontend |
| **Verification** | DB phase status matches worker state |

---

## End-to-End Install Simulation

**Method:** Code trace + prior production DB audit (2026-07-09). **No new live install executed in Phase C.**

| Step | Started | Completed | Duration | Evidence |
|------|---------|-----------|----------|----------|
| OAuth | ✅ | ✅ | — | Store row exists |
| Store/org/billing | ✅ | ✅ | — | Audit store ID present |
| bootstrap queued | ✅ | — | — | Job ID in audit |
| Products imported | ❌ | ❌ | — | 0 products |
| Full pipeline | ❌ | ❌ | — | Worker never ran |

**Conclusion:** E2E automatic onboarding **not proven** in production.
