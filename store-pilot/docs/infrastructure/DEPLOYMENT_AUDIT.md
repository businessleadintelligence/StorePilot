# Deployment Audit

## Current State

Vercel builds the web app. Railway-style worker deployment is represented by `Dockerfile.worker`. Prisma migrations are available, and startup readiness can detect missing migrations. Scripts exist for Vercel env sync and Supabase provisioning guidance.

## Strengths

- Separate worker image exists.
- Build runs Prisma generation.
- Startup readiness checks migrations.
- Environment variables are documented.
- Production hardening docs exist in prior audit docs.

## Weaknesses

- No CI/CD pipeline definition was found in this audit output.
- No canary, blue/green, or staged rollout configuration was found.
- No deployment rollback commands are documented in the active infrastructure docs.
- No migration deploy ownership is defined between Vercel, Railway, and manual ops.
- Worker image uses dev runtime tooling.
- No post-deploy smoke test gate was found.

## Risk Level

High.

## Recommendations

- Define deployment ownership: migrations first, web deploy second, worker deploy third.
- Add smoke tests after deploy: health, readiness, queue enqueue/claim, cron auth, Shopify env, AI health.
- Add rollback runbook for web and worker separately.
- Use canary rollout for workers and disable old workers after drain.
- Add production deploy checklist.

## Priority

P1.

## Estimated Engineering Effort

1 to 2 weeks.
