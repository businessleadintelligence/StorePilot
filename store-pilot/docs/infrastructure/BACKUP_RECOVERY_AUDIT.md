# Backup and Recovery Audit

## Current State

The repo references Supabase daily backups in planning documentation, but does not include a complete backup policy, restore procedure, PITR validation, restore drill evidence, or backup failure alerting.

## Strengths

- Supabase/Postgres is the likely database platform, which can support managed backups depending on plan.
- Prisma migrations are tracked in repo.
- Startup readiness checks whether repo migrations are applied.

## Weaknesses

- No restore runbook with commands and verification steps was found.
- No RTO/RPO values are defined.
- No automated restore drill exists.
- No backup failure monitoring or alerting exists in repo.
- No migration rollback plan.
- No queue recovery procedure after partial restore.
- No provider data recovery procedure for AI, graph snapshots, or business memory.

## Risk Level

Critical.

## Recommendations

- Define RTO and RPO: initial target RTO 4 hours, RPO 24 hours or better; tighten after PITR is enabled.
- Confirm Supabase plan, backup frequency, retention, and PITR.
- Create monthly restore drill into isolated project.
- Add data verification queries after restore.
- Document queue recovery after restore: pause workers, inspect running/claimed jobs, release stale locks, replay idempotent jobs.
- Alert on backup failure and missed restore drill.

## Priority

P0.

## Estimated Engineering Effort

3 to 7 days for initial runbook and drill; 2 to 4 weeks for mature DR automation.
