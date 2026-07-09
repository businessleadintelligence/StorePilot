# StorePilot — Backup and Recovery

**Sprint:** 7 — Backups  
**Date:** 2026-07-09  
**Scope:** Strategy and runbooks only — no application code changes in this sprint  
**Production stack:** Vercel (compute) · Supabase PostgreSQL (data) · Shopify (merchant platform) · GitHub (source)

---

## Executive summary

StorePilot recovery depends on **four independent backup layers**:

| Layer | Source of truth | Primary backup mechanism |
|-------|-----------------|--------------------------|
| **Database** | Supabase PostgreSQL | Supabase automated backups + optional PITR |
| **Schema / migrations** | Git repository | Version-controlled `prisma/migrations/` |
| **Configuration** | Git + platform dashboards | Git tags + exported platform settings |
| **Secrets** | Secret manager / Vercel | Encrypted offline store (never in git) |

**Critical constraint:** Session and connector tokens in Postgres are encrypted with `TOKEN_ENCRYPTION_KEY`. Restoring a database snapshot without the **same** encryption key makes offline Shopify sessions unreadable. Treat the encryption key as part of database recovery.

---

## Recovery objectives

| Metric | Target (initial) | Notes |
|--------|------------------|-------|
| **RPO** (max data loss) | 24 hours (Free) / 5 min–1 hr (PITR on Pro+) | Depends on Supabase plan |
| **RTO** (time to restore service) | 4 hours (full stack) | App redeploy is fast; DB restore dominates |
| **Migration RPO** | 0 (git commit) | Migrations are immutable in version control |
| **Config RPO** | 0 (git commit) | `shopify.app.toml`, `vercel.json`, etc. |

Adjust targets when moving from pilot to paid Supabase tier or multi-region deployment.

---

## 1. Database backups

### Platform

| Item | Value |
|------|-------|
| Provider | Supabase (PostgreSQL) |
| Access | Prisma via `DATABASE_URL` (pooler) and `DIRECT_URL` (migrations) |
| Region | `ap-northeast-1` (Tokyo) — project `rbzhmuqduircqloqoepa` |
| Application ORM | Prisma 6.x |

StorePilot does **not** implement application-level database dumps. All database backup responsibility sits with **Supabase** and optional operator-run exports.

### Supabase automated backups

| Plan | Daily backups | Retention | PITR |
|------|---------------|-----------|------|
| Free | Yes (logical) | 7 days | No |
| Pro+ | Yes | 7–30+ days (plan-dependent) | Yes (WAL-based) |

**Action items (operator):**

1. Confirm Supabase project plan and backup retention in **Dashboard → Project Settings → Database → Backups**.
2. Enable **Point-in-Time Recovery** when on a plan that supports it (see Section 6).
3. Document the Supabase organization owner and billing contact for emergency restore requests.

### Manual logical exports (supplementary)

Use for pre-migration safety, compliance exports, or off-platform archive. Run against `DIRECT_URL` (not the pooler) for consistent dumps.

```bash
# From operator workstation — replace placeholders; never commit output files
pg_dump "$DIRECT_URL" \
  --format=custom \
  --no-owner \
  --file="storepilot-$(date +%Y%m%d-%H%M%S).dump"
```

| Format | Use case |
|--------|----------|
| `--format=custom` (`.dump`) | Restorable with `pg_restore`; supports selective table restore |
| `--format=plain` (`.sql`) | Human-readable; larger files |
| Directory format | Very large databases |

**Storage for manual dumps:**

- Encrypt at rest (AES-256 or cloud KMS).
- Store in a separate account/region from production (e.g. S3 cross-region, Google Drive with 2FA — not git).
- Retain naming convention: `storepilot-YYYYMMDD-HHMMSS.dump`.
- Delete dumps older than policy (suggested: 90 days for manual, unless compliance requires longer).

### What the database contains

| Data class | Recovery note |
|------------|---------------|
| Shopify sessions (encrypted) | Requires original `TOKEN_ENCRYPTION_KEY` |
| Store / product / order aggregates | Restorable from backup |
| `sync_jobs` queue | Restorable; reconcile with Shopify after restore |
| AI execution telemetry | Restorable |
| Billing / subscription state | Restorable; verify against Shopify Billing API |
| GDPR export records | Restorable; compliance-sensitive |

### What is NOT in the database

Merchant catalog and orders can be **re-synced from Shopify** after a disaster if sessions are re-established (merchants re-authenticate). Design recovery playbooks to use Shopify as the authoritative source for commerce data where possible.

---

## 2. Prisma migration backups

### Source of truth: Git

All schema history lives in the repository:

```
store-pilot/prisma/schema.prisma
store-pilot/prisma/migrations/
  migration_lock.toml
  20240530213853_create_session_table/
  … (22 migration folders)
```

| Property | Value |
|----------|-------|
| Migration count | 22 |
| Provider lock | `postgresql` (`migration_lock.toml`) |
| Deploy command | `npx prisma migrate deploy` |
| Status check | `npx prisma migrate status` |

**Migrations are the backup.** Every applied migration is an immutable, timestamped SQL file. Do not edit applied migration SQL in production branches.

### Backup practices

| Practice | Frequency | Owner |
|----------|-----------|-------|
| Git push to `main` | Every merge | Engineering |
| Git tag on production releases | Each deploy (e.g. `v1.0-recovered`) | Engineering |
| GitHub branch protection on `main` | Always | Engineering |
| Optional: mirror repo to second remote | Monthly | Operator |

### Pre-migration safety snapshot

Before **any** production migration:

1. Confirm Supabase daily backup completed (dashboard).
2. Optional: run `pg_dump` manual export (Section 1).
3. Run `npx prisma migrate deploy` against a **staging** database first.
4. Run `npx prisma migrate status` on production after deploy.

See [`docs/MIGRATION_REPAIR_REPORT.md`](./MIGRATION_REPAIR_REPORT.md) for dependency-chain lessons learned.

### Rollback strategy

Prisma has **no automatic down migrations** in production. Rollback options:

| Scenario | Approach |
|----------|----------|
| Migration not yet applied | Do not deploy; fix forward in new migration |
| Migration applied, app broken | Redeploy previous app git tag; DB may need manual SQL fix or restore |
| Migration applied, data corrupt | Restore database from backup to pre-migration point (PITR or daily snapshot) |

**Never** run `prisma migrate reset` against production.

---

## 3. Configuration backups

### Version-controlled configuration (Git)

| File | Contents |
|------|----------|
| `store-pilot/shopify.app.toml` | App URL, scopes, webhooks, API version |
| `store-pilot/vercel.json` | Build command, security headers |
| `store-pilot/react-router.config.ts` | Vercel preset |
| `store-pilot/package.json` / `package-lock.json` | Dependencies |
| `store-pilot/prisma/schema.prisma` | Data model |
| `.gitignore` | Excludes `.env`, secrets |

**Recovery:** `git checkout <tag>` → redeploy to Vercel.

### Platform-managed configuration (export manually)

These are **not** fully captured in git. Export or document on each production change:

| Platform | What to backup | How |
|----------|----------------|-----|
| **Vercel** | Root directory, env var *names*, domains, cron settings | Dashboard screenshot + `vercel env ls` (names only) |
| **Shopify Partner** | App URL, redirect URLs, webhooks | `shopify app deploy` + Partner Dashboard export/screenshot |
| **Supabase** | Connection strings (stored in secret manager), RLS policies, extensions | Dashboard settings; pooler vs direct URLs |
| **GitHub** | Repo access, deploy keys, Actions secrets | Org settings audit |

### Configuration manifest (recommended)

Maintain a non-secret checklist file (or secure wiki) updated on each release:

```markdown
## StorePilot Production Config Manifest — YYYY-MM-DD
- Git tag: v1.x.x
- Vercel project: store-pilot (root: store-pilot)
- Production URL: https://store-pilot-eta.vercel.app
- Supabase project: rbzhmuqduircqloqoepa (ap-northeast-1)
- Shopify client_id: (from shopify.app.toml — public)
- Migrations applied: 22/22
- Last shopify app deploy: YYYY-MM-DD
```

Store manifests in `docs/releases/` or an internal wiki — **not** secrets.

### Vercel deployment history

Vercel retains deployment artifacts and rollback capability per deployment. Use **Instant Rollback** for app-only regressions without database changes.

---

## 4. Secrets backup policy

### Golden rules

1. **Never** commit secrets to git (`.env`, API keys, connection strings).
2. **Never** store secrets in backup dumps without encryption.
3. **Never** log secret values (see [`docs/LOGGING_ARCHITECTURE.md`](./LOGGING_ARCHITECTURE.md)).
4. Treat `TOKEN_ENCRYPTION_KEY` as **irreplaceable** — losing it invalidates encrypted session data.

### Secret inventory

| Secret | Storage (production) | Backup method |
|--------|----------------------|---------------|
| `DATABASE_URL` | Vercel env | Password manager + Supabase dashboard |
| `DIRECT_URL` | Vercel env | Password manager + Supabase dashboard |
| `SHOPIFY_API_SECRET` | Vercel env | Password manager + Shopify Partner Dashboard |
| `TOKEN_ENCRYPTION_KEY` | Vercel env | **Encrypted offline vault** (1Password, Bitwarden org vault) |
| `CRON_SECRET` | Vercel env | Password manager |
| `OPENAI_API_KEY` | Vercel env | OpenAI dashboard + password manager |
| `GOOGLE_CLIENT_SECRET` | Vercel env | Google Cloud Console + password manager |

Full variable list: [`docs/ENVIRONMENT_VARIABLES.md`](./ENVIRONMENT_VARIABLES.md).

### Recommended backup procedure

| Step | Action |
|------|--------|
| 1 | Store all production secrets in an **organization password manager** (separate from personal accounts). |
| 2 | Export an **encrypted emergency kit** quarterly (password manager secure export). |
| 3 | Restrict access to 2–3 founders/operators with MFA. |
| 4 | Document secret **rotation dates** in the config manifest. |
| 5 | After rotation, update Vercel Production env and redeploy. |

### What NOT to back up

| Item | Reason |
|------|--------|
| `SUPABASE_ANON_KEY` / `SERVICE_ROLE_KEY` | Not used by StorePilot runtime |
| Plaintext `.env` on developer laptops | High leak risk; use password manager instead |
| Shopify offline access tokens from DB | Already in encrypted DB backup; redundant and sensitive |

### Rotation triggers

Rotate secrets immediately when:

- Team member with vault access departs
- Suspected leak (git commit, log exposure, support ticket)
- Annual security review
- Shopify or Supabase security advisory

---

## 5. Recovery testing

### Goals

Prove that backups and runbooks work **before** an incident. Untested backups are assumptions.

### Test schedule

| Test | Frequency | Environment | Duration |
|------|-----------|-------------|----------|
| **Readiness drill** | Weekly (automated) | Production | 5 min |
| **Migration dry-run** | Before each prod migration | Staging DB | 30 min |
| **Full DB restore drill** | Quarterly | Staging / clone project | 2–4 hours |
| **PITR drill** | Semi-annual (if PITR enabled) | Supabase branch or clone | 2–4 hours |
| **Secrets recovery drill** | Annual | Operator workstation | 1 hour |
| **App rollback drill** | Quarterly | Vercel | 15 min |

### Weekly automated checks (already available)

```bash
curl -sf https://store-pilot-eta.vercel.app/health/ready
curl -sf https://store-pilot-eta.vercel.app/health/monitor
```

See [`docs/MONITORING_SETUP.md`](./MONITORING_SETUP.md).

### Quarterly database restore drill

**Objective:** Restore a backup to a non-production Supabase project and verify app connectivity.

| Step | Action | Pass criteria |
|------|--------|---------------|
| 1 | Create new Supabase project (or use staging) | Project provisioned |
| 2 | Restore from latest daily backup OR `pg_restore` manual dump | `SELECT 1` succeeds |
| 3 | Point staging Vercel env `DATABASE_URL` / `DIRECT_URL` at restored DB | `/health/monitor` → `database: healthy` |
| 4 | Run `npx prisma migrate status` | All migrations applied or deploy succeeds |
| 5 | Install app on dev store; verify OAuth | Auth completes |
| 6 | Trigger product sync | Products appear in DB |
| 7 | Document elapsed time and issues | RTO estimate updated |

**Record results** in a drill log (date, operator, RTO achieved, blockers).

### App-only rollback drill

| Step | Action |
|------|--------|
| 1 | Identify previous good Vercel deployment in dashboard |
| 2 | Promote / rollback to that deployment |
| 3 | Verify `/health`, install flow, one webhook |
| 4 | Confirm no migration drift (same DB schema) |

### Failure scenarios to rehearse

| Scenario | Primary recovery |
|----------|------------------|
| Bad deploy (app bug) | Vercel rollback |
| Bad migration | PITR or daily restore + fix-forward migration |
| Supabase region outage | Wait for provider / future: read replica |
| Lost `TOKEN_ENCRYPTION_KEY` | Cannot decrypt sessions; merchants re-install / re-auth |
| Lost all Vercel env secrets | Restore from password manager; redeploy |
| Deleted Supabase project | Restore from Supabase support (if within retention) or manual dump |

---

## 6. Point-in-time recovery (PITR)

### Overview

**Point-in-Time Recovery** restores PostgreSQL to any second within the retention window using write-ahead log (WAL) archiving. Available on **Supabase Pro plan and above** (not on Free tier).

### When to use PITR vs daily backup

| Situation | Use |
|-----------|-----|
| Accidental `DELETE` / `UPDATE` without transaction | PITR |
| Bad migration applied 2 hours ago | PITR to timestamp before migration |
| Database corruption discovered next day | Daily backup (if outside PITR window) |
| Full region disaster | Daily backup in separate region (if exported) |

### PITR procedure (Supabase Dashboard)

1. **Dashboard → Database → Backups → Point in Time**
2. Select target timestamp (UTC) — choose last known good moment.
3. Restore to:
   - **New project** (recommended for validation), or
   - **Replace current** (production cutover — high risk)
4. Update `DATABASE_URL` and `DIRECT_URL` in Vercel if connection strings change.
5. Run verification:
   ```bash
   curl -s https://<app>/health/monitor | jq '.checks[] | select(.id=="database")'
   npx prisma migrate status
   ```
6. Merchants with sessions created **after** restore point must re-authenticate if sessions were lost.

### PITR limitations

| Limitation | Mitigation |
|------------|------------|
| Retention window (e.g. 7 days) | Manual dumps for longer archive |
| Does not restore Vercel env or Shopify config | Config backup (Section 3) |
| Encrypted sessions need same `TOKEN_ENCRYPTION_KEY` | Secrets policy (Section 4) |
| Connection string may change on new project | Update Vercel env before traffic |

### RPO with PITR

With PITR enabled, effective **RPO ≈ minutes** (last WAL flush interval). Without PITR, **RPO ≈ 24 hours** (daily backup).

---

## 7. Recovery runbooks

### Runbook A — Application regression (no schema change)

```
1. Vercel → Deployments → Rollback to last green deployment
2. curl /health/ready && /health/monitor
3. Smoke test: OAuth on dev store, one webhook
4. Post-incident: git bisect, fix forward
```

**Estimated RTO:** 15 minutes.

### Runbook B — Bad production migration

```
1. Stop deploys; announce incident
2. Assess: can fix forward with new migration? If yes → prefer fix-forward
3. If data corrupt:
   a. Note migration timestamp T_bad
   b. Supabase PITR to T_bad - 5 minutes (or restore daily backup)
   c. Restore to staging first; validate row counts
   d. Cut over DATABASE_URL in Vercel
   e. Redeploy known-good git tag
4. prisma migrate status — resolve drift
5. Merchants may need to re-open app (session invalidation)
```

**Estimated RTO:** 2–4 hours.

### Runbook C — Complete database loss

```
1. Provision Supabase project (or restore from Supabase backup UI)
2. Restore latest pg_dump OR Supabase backup
3. Set DATABASE_URL, DIRECT_URL in Vercel
4. npx prisma migrate deploy (should show already applied)
5. Deploy latest production git tag
6. Verify /health/monitor (all checks green)
7. Dev store: reinstall app, full product bootstrap
8. Configure cron worker scheduler (POST /cron/worker)
```

**Estimated RTO:** 4–8 hours.

### Runbook D — Lost encryption key

```
1. Generate new TOKEN_ENCRYPTION_KEY
2. Update Vercel env
3. Redeploy app
4. All existing encrypted sessions are UNREADABLE
5. Merchants must re-authenticate (reinstall or reopen app)
6. Re-connect Google/Clarity integrations per store
```

**Data loss:** Offline tokens only; business data in Postgres remains.

---

## 8. Responsibilities

| Role | Responsibility |
|------|----------------|
| **Founder / operator** | Supabase backup settings, PITR enablement, quarterly drills |
| **Engineering** | Git tags, migration discipline, staging validation |
| **Security** | Secrets vault, rotation, drill participation |
| **On-call** (future) | Execute runbooks, communicate RTO to merchants |

---

## 9. Compliance and retention

| Data type | Suggested retention | Backup includes |
|-----------|---------------------|-----------------|
| Merchant operational data | Life of store + 30 days | DB backup |
| GDPR export artifacts | Per Shopify policy | DB backup |
| Application logs (Vercel) | 3–30 days (plan) | Not in DB backup |
| Manual pg_dump archives | 90 days | Operator S3/vault |
| Git history | Indefinite | GitHub |

Align with Shopify App Store data handling requirements and [`store-pilot/docs/PRIVACY_BY_ARCHITECTURE.md`](../store-pilot/docs/PRIVACY_BY_ARCHITECTURE.md).

---

## 10. Current gaps and recommendations

| Gap | Risk | Recommendation |
|-----|------|----------------|
| Supabase Free tier (no PITR) | Up to 24h data loss | Upgrade to Pro before production merchants |
| No documented drill history | Unknown RTO | Run first quarterly restore drill |
| Secrets not in org vault | Key loss blocks recovery | Migrate to 1Password/Bitwarden Teams |
| Manual dumps not scheduled | No long-term archive | Monthly `pg_dump` to encrypted S3 |
| `TOKEN_ENCRYPTION_KEY` not in vault | Session loss on key loss | Add to emergency kit immediately |
| Cron scheduler external | Jobs stall after restore | Document scheduler config in manifest |

---

## 11. Related documentation

| Document | Topic |
|----------|-------|
| [`docs/ENVIRONMENT_VARIABLES.md`](./ENVIRONMENT_VARIABLES.md) | Secrets inventory |
| [`docs/VERCEL_SETUP_REPORT.md`](./VERCEL_SETUP_REPORT.md) | Deploy and migration deploy |
| [`docs/MONITORING_SETUP.md`](./MONITORING_SETUP.md) | Health endpoints for post-restore verification |
| [`docs/MIGRATION_REPAIR_REPORT.md`](./MIGRATION_REPAIR_REPORT.md) | Migration chain integrity |
| [`docs/LOGGING_ARCHITECTURE.md`](./LOGGING_ARCHITECTURE.md) | Incident log correlation |

---

## Document control

| Version | Date | Author | Change |
|---------|------|--------|--------|
| 1.0 | 2026-07-09 | Sprint 7 | Initial backup and recovery strategy |

**Next review:** Before first paying merchant or Supabase plan upgrade — whichever comes first.
