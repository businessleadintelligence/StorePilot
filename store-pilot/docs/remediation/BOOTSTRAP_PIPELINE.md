# Bootstrap Pipeline — Phase C.2

## Phase Progress Model (corrected)

| Milestone | Progress | When set |
|-----------|----------|----------|
| Install / OAuth | 0% | Before any phase completes |
| Products complete | 33% | `markPhaseCompleted(PRODUCTS)` |
| Inventory complete | 66% | `markPhaseCompleted(INVENTORY)` |
| Orders complete / blocked | 90% | `markPhaseCompleted(ORDERS)` or blocked |
| All phases done | 100% | `OnboardingStatus.completed` |

**Never** set 33/66/90 at enqueue time.

## Job Lifecycle (per phase)

```
advanceOnboarding()
  → enqueueAndLinkPhaseJob()
    → sync_jobs.status = queued
    → phase status = queued
    → progressLabel = "Products queued"

Worker claimNextJob()
  → sync_jobs.status = claimed
  → UI derives "Claimed" from job status

beginJobExecution() + markPhaseStarted()
  → sync_jobs.status = running
  → phase status = running
  → progressLabel = "Syncing products"

finalizeSuccessfulJobPhase()
  → sync_jobs.status = completed
  → phase status = completed
  → progressPercent = 33|66|90
  → advanceOnboarding() enqueues next phase
```

## Downstream Jobs (unchanged)

After products sync, worker schedules (fire-and-forget):

- Knowledge ingest → graph build → historical intelligence → quick wins → executive → etc.

These run as separate queue jobs after bootstrap phases complete.

## Repair Paths

| Condition | Action |
|-----------|--------|
| Phase queued/running + job cancelled | Reset phase, new `onboardingRunId`, re-enqueue |
| Phase queued/running + job completed | `markPhaseCompleted` + advance |
| Phase queued/running + job dead_letter | `markPhaseFailed` |

Called from `repairTerminalPhaseJobs()` inside `executeAdvanceOnboarding()`.

## UI Alignment

- `getOnboardingStatus()` computes progress from phase completion
- `SyncStatusCard` badges: Queued, Claimed, Running, Failed, Cancelled
- Setup progress bar uses real `progressPercent` from loader
