# Onboarding State Machine — Phase C.2

## States

| State | Source of truth | Badge |
|-------|-----------------|-------|
| Queued | Phase `queued` + job `queued` | Queued |
| Claimed | Phase `queued` + job `claimed` | Claimed |
| Running | Phase `running` + job `running` | Running |
| Retrying | Job `retrying` | Retrying |
| Completed | Phase `completed` | Completed |
| Failed | Phase `failed` or job `dead_letter` | Failed |
| Cancelled | Job `cancelled` | Cancelled |
| Blocked | Phase `blocked` | Blocked |

Implementation: `app/services/onboarding-display-state.server.ts`

## Dashboard Derivation

```
getOnboardingStatus(storeId)
  ├── store_onboarding (phase statuses)
  └── sync_jobs (currentJobId → status)
        └── resolvePhasePipelineState()
              └── buildPhasePipelineView() → badge, description, nextAction, showRetry
```

## Before vs After

| Scenario | Before (bug) | After (fix) |
|----------|--------------|-------------|
| Job enqueued, no worker | UI: "Syncing products" 33% | UI: "Products queued" 0% |
| Job cancelled in DB | UI: "Syncing products" | UI: "Cancelled" + retry |
| Job claimed | UI: "Syncing" | UI: "Claimed" |
| Worker running | UI: correct if DB running | UI: "Running" + label |

## Retry

`showRetry: true` for Failed and Cancelled pipeline states. Existing `retryOnboardingPhase()` creates new run-scoped job.

## Components Updated

- `SyncStatusCard.tsx` — per-domain badges from job-aware `getSyncStatusBadge()`
- `OnboardingCard.tsx` — uses computed `progressLabel` from loader
- `app._index.tsx` — passes `currentJobStatus` + `setupProgressPercent`
