# Daily Operating Plan

Structured daily task plan for merchants.

## Contents

- Title: "Today's Business Plan"
- Estimated completion time (minutes)
- Estimated revenue opportunity
- Estimated profit opportunity (35% margin estimate)
- Task count
- Priority-ordered tasks

## Each task includes

- Title, description, reason
- Evidence IDs
- Business impact, effort, time, confidence
- Actions: approve, ignore, learn_more

## Generation

1. **Deterministic** — top ranked executive decisions converted to tasks
2. **AI-enhanced** — Foundation `executive_summary` tier when enabled

## Persistence

`daily_operating_plans` keyed by `(storeId, planDate)`.

## Regeneration triggers

- After executive decision engine runs
- Morning cron (`executive_brief_generate` → COO job)
- Post-sync refresh (future webhook hooks)
