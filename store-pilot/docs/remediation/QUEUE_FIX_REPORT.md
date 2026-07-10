# Queue Fix Report — Phase C.2

## Root Cause: Bootstrap Job Cancelled Without Worker Claim

### Evidence (production, 2026-07-10)

| Field | Value |
|-------|-------|
| Job type | `bootstrap_products` |
| Status | `cancelled` |
| Attempts | 0 |
| Worker instances | 0 |
| Onboarding UI | 33% "Syncing products" (stale) |

### Who Cancels?

| Path | Code | When |
|------|------|------|
| **Uninstall / deactivation** | `cancelStoreJobsOnUninstall()` | `deactivateStoreOnUninstall()` → billing cleanup |
| Manual test only | `cancelJob()` | Tests only — not production path |
| Stale release | `releaseStaleJobs()` | Re-queues to `retrying`, not `cancelled` |

**Conclusion:** Production cancellation at `2026-07-10T00:06:43Z` with `attempts=0` is consistent with **`cancelStoreJobsOnUninstall`** (app/uninstalled or billing uninstall), not worker timeout.

### Secondary Bug: Idempotency Resurrects Cancelled Jobs

`enqueueJobWithClient()` returned existing rows by `idempotencyKey` even when **terminal** (`cancelled`). Key without run ID: `onboarding:{storeId}:products`.

**Effect:** After cancel, `advanceOnboarding()` noop'd on stale `running` phase + dead job link → merchant stuck forever.

## Fixes Applied

### 1. Terminal job bypass (`onboarding.server.ts`)

- Always use `onboardingRunId` in idempotency keys
- If enqueue returns terminal job → bump `onboardingRunId` and create fresh job
- `repairTerminalPhaseJobs()` at advance time resets cancelled phases

### 2. Phase status truth

- Enqueue → `productSyncStatus: queued` (not `running`)
- Worker `beginJobExecution` → `markPhaseStarted()` → `running`
- Progress % only from **completed** phases (0 → 33 → 66 → 90 → 100)

### 3. Cancel includes claimed jobs (`job.server.ts`)

```typescript
status: { in: [queued, claimed, running, retrying] }
```

Prevents orphaned `claimed` jobs after uninstall.

### 4. Reconcile handles queued phases

`reconcileOnboardingWithCompletedJobs()` now repairs both `queued` and `running` when linked job is terminal.

## Verification

- `f34-onboarding-state-machine.test.ts` — enqueue = queued, progress = 0
- `f35-job-reliability.test.ts` — retry/resume = queued
- `f38-worker-reliability-hardening.test.ts` — repair advances to queued inventory
- Full suite: **3033 passed**

## Post-Deploy Verification

```sql
SELECT id, "jobType", status, attempts, "cancelledAt", "idempotencyKey"
FROM sync_jobs WHERE "storeId" = '<store-id>' ORDER BY "createdAt";
```

Expected lifecycle: `queued` → `claimed` → `running` → `completed` (never `cancelled` on happy path).
