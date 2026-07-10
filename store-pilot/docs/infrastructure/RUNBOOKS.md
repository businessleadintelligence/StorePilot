# Production Runbooks

## Current State

Runbooks are generated here because the repository did not contain a complete production operations runbook set for the requested incidents.

## Strengths

- Health and worker endpoints exist.
- Queue and startup readiness primitives exist.
- Worker stale recovery and queue retry primitives exist.

## Weaknesses

- Commands must be adapted to the actual Vercel, Railway, and Supabase project names.
- No external incident tooling is wired in repo.
- No tested backup restore drill evidence exists.

## Risk Level

High until runbooks are rehearsed.

## Recommendations

- Assign owners for every runbook.
- Test P0 runbooks before launch.
- Store final versions in `docs/infrastructure` and link them from onboarding/deployment docs.

## Priority

P0 for Worker Down, Queue Backlog, Database Restore, Cron Failure, GDPR Delete Failure, and Incident Response. P1 for the rest.

## Estimated Engineering Effort

1 week to adapt and rehearse initial runbooks.

---

## Worker Down

Symptoms: `/health/worker` reports no active workers, queue age grows, Railway process stopped.

Diagnosis: check Railway service status, worker logs, `WorkerInstance` active rows, queue oldest age, recent deploys.

Commands:

```bash
railway status
railway logs
curl https://APP_URL/health/worker
```

Recovery: restart worker, rollback last worker deploy if needed, release stale jobs through retry queue cron or admin script.

Verification: active worker heartbeat updates, oldest queued age decreases, no new dead-letter spike.

Rollback: redeploy previous worker image.

## Queue Backlog

Symptoms: oldest queued job age over SLO, merchant sync delayed, dead letters increasing.

Diagnosis: inspect queue metrics by JobType, active workers, provider errors, DB latency.

Commands:

```bash
curl https://APP_URL/health/worker
curl https://APP_URL/health/monitor
```

Recovery: scale workers, pause noisy jobs, release stale locks, replay dead letters only after root cause is fixed.

Verification: throughput exceeds enqueue rate and backlog age falls.

Rollback: reduce worker count if database/provider throttling worsens.

## AI Outage

Symptoms: AI health degraded, OpenAI/Anthropic errors, user AI features fail.

Diagnosis: provider status, AI health endpoint, recent model/env changes, error logs.

Recovery: switch provider/tier, disable AI enhancement features, use deterministic fallback where available.

Verification: AI health green or features gracefully degrade.

Rollback: restore original provider after status recovery.

## Database Restore

Symptoms: data corruption, accidental delete, database unavailable beyond provider recovery.

Diagnosis: identify incident time, affected tables, latest safe backup/PITR point, stop writes.

Commands:

```bash
# Provider-specific: restore Supabase backup/PITR to isolated project first.
npx prisma migrate status
```

Recovery: pause workers and crons, restore to isolated DB, verify row counts and migrations, promote restored DB or selectively recover data.

Verification: app readiness green, queue state sane, spot-check stores, run privacy and GDPR checks.

Rollback: return DATABASE_URL to prior DB if restore validation fails.

## Failed Migration

Symptoms: deploy fails, startup readiness reports missing migrations, runtime Prisma errors.

Diagnosis: inspect migration logs, `_prisma_migrations`, schema diff, failed SQL.

Recovery: stop deploy, restore backup if destructive, patch forward with a corrective migration when possible.

Verification: `prisma migrate status`, startup readiness green, smoke tests pass.

Rollback: app rollback plus DB restore if migration changed data destructively.

## GDPR Delete Failure

Symptoms: GDPR webhook error, shop/customer redact incomplete, Shopify compliance risk.

Diagnosis: inspect GDPR logs, webhook ID, store ID, order IDs, deletion transaction failure.

Recovery: manually rerun redact handler or targeted deletion script after validating payload; preserve audit event.

Verification: no prohibited customer PII remains, webhook result recorded, Shopify response acknowledged.

Rollback: not applicable for deletion; restore only if accidental over-delete affects non-target store.

## Shopify Webhook Failure

Symptoms: webhook route errors, duplicate deliveries, backlog of webhook events.

Diagnosis: verify Shopify HMAC, route logs, WebhookEvent state, processing lease, provider status.

Recovery: fix handler issue, release expired processing leases, allow Shopify retry or manually replay idempotent event.

Verification: webhook events processed successfully and duplicate deliveries skipped.

Rollback: revert faulty deploy.

## Cron Failure

Symptoms: cron heartbeat missing, maintenance jobs stale, retry queue not releasing jobs.

Diagnosis: verify `CRON_SECRET`, Vercel cron logs, schedule manifest, endpoint response.

Commands:

```bash
curl -H "x-cron-secret: SECRET" https://APP_URL/cron/worker
```

Recovery: restore CRON_SECRET, fix schedule, manually invoke missed cron jobs, deploy canonical cron file.

Verification: next scheduled run succeeds and health shows fresh cron activity.

Rollback: revert cron config.

## OpenAI Outage

Symptoms: OpenAI errors, rate limit, timeout.

Diagnosis: check AI health, provider status, model routing, recent prompt/deploy changes.

Recovery: route to Anthropic or deterministic fallback, lower max tokens, disable nonessential AI jobs.

Verification: no high-severity AI errors, spend remains controlled.

Rollback: return routes to OpenAI after provider recovery.

## Anthropic Outage

Symptoms: Anthropic errors, timeout, rate limit.

Diagnosis: check AI health, provider status, API key, base URL, routing rules.

Recovery: route to OpenAI or deterministic fallback.

Verification: affected features recover or degrade gracefully.

Rollback: return routes to Anthropic after provider recovery.

## High AI Spend

Symptoms: cost dashboard spike, merchant usage spike, provider invoice anomaly.

Diagnosis: identify store, feature, model tier, prompt, token count, cache misses.

Recovery: disable expensive feature, force nano/fast tier, lower max tokens, pause AI cron jobs.

Verification: spend slope returns to expected range.

Rollback: restore normal routing after root cause fixed.

## Emergency Read-Only Mode

Symptoms: write path corruption, database instability, incident requiring write freeze.

Diagnosis: identify affected writes, stores, migrations, worker jobs, and active deploys.

Recovery: enable read-only guard once implemented, stop workers and crons, block mutating routes except compliance webhooks.

Verification: reads work, writes fail safely, compliance endpoints still acknowledged.

Rollback: disable read-only mode after data integrity verified.

## Production Rollback

Symptoms: error spike after deploy, startup readiness failed, worker crash loop.

Diagnosis: identify bad release, migration status, worker image, env changes.

Recovery: rollback Vercel deploy, rollback Railway worker image, avoid DB rollback unless migration caused data issue.

Verification: health endpoints green, error rate normal, queue drains.

Rollback: re-promote fixed release.

## Secret Rotation

Symptoms: scheduled rotation or suspected leak.

Diagnosis: identify affected secret, blast radius, dependent services, and whether dual-read is needed.

Recovery: create new secret, deploy dual-read if necessary, update Vercel/Railway/Supabase, restart services, revoke old secret.

Verification: startup readiness green, provider calls succeed, old key rejected.

Rollback: temporarily restore old secret only if it is not compromised and rotation breaks production.

## Incident Response

Symptoms: any P0/P1 incident.

Diagnosis: assign incident commander, declare severity, open incident channel, stop risky deploys, preserve logs, identify user impact.

Recovery: execute the relevant runbook, communicate status, assign owners, track decisions and timestamps.

Verification: user impact ended, monitors green, postmortem created.

Rollback: revert any emergency changes after permanent fix.
