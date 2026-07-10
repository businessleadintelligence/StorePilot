# 06 — Queue Certification

**Date:** 2026-07-10T09:00Z  
**Status:** 🔴 **FAIL**

## Production evidence (C.1 / C.2 pre-deploy)

| Observation | Value |
|-------------|-------|
| bootstrap_products | `cancelled`, attempts=0 |
| Worker claims | None |
| Onboarding stuck | 33%, productSyncStatus=running (UI lie) |

## Local code / test evidence

| Check | Status | Evidence |
|-------|--------|----------|
| queued → claimed → running | 🟢 Code | C.2 onboarding + worker markPhaseStarted |
| Idempotency run-scoped | 🟢 Code | `onboardingRunId` in keys |
| Terminal job repair | 🟢 Code | `repairTerminalPhaseJobs` |
| cancel includes claimed | 🟢 Code | `job.server.ts` |
| Duplicate job prevention | 🟢 Test | f34 test 6 |
| Dead letter path | 🟢 Test | f35, f618 |
| Reconcile completed jobs | 🟢 Test | f38 test 3 |

## NOT VERIFIED (requires deploy + fresh store)

| Transition | Status |
|------------|--------|
| queued | NOT VERIFIED |
| claimed | NOT VERIFIED |
| running | NOT VERIFIED |
| completed | NOT VERIFIED |
| No cancelled bootstrap | NOT VERIFIED |
| No orphan jobs | NOT VERIFIED |
| Replay / retry | NOT VERIFIED |

## SQL verification (post E2E)

```sql
SELECT "jobType", status, attempts, "cancelledAt"
FROM sync_jobs WHERE "storeId" = '<fresh-store>'
ORDER BY "createdAt";
```

## Certification result

**NOT CERTIFIED**
