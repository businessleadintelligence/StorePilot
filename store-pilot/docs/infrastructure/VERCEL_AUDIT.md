# Vercel Audit

## Current State

`vercel.json` defines `npm run build`, `npm install`, security headers, and scheduled cron paths. The app is Remix/React Router based, with routes under `app/routes`. Vercel cron calls `/cron/worker` every two minutes and several dispatch endpoints daily. A separate `vercel.pro.crons.json` contains additional production cron entries that are not present in `vercel.json`.

## Strengths

- Security headers are configured for general routes and assets.
- Health endpoints are marked no-store.
- Cron endpoints are authenticated through `CRON_SECRET` checks.
- Serverless database pool guidance exists for `connection_limit=1`, `pgbouncer=true`, and `pool_timeout`.
- Build command runs Prisma generation before app build through the package build script.

## Weaknesses

- Cron source of truth is unclear: deployed `vercel.json` omits jobs present in `vercel.pro.crons.json`.
- No repo evidence of max duration, memory, or region settings for heavy routes.
- No bundle-size report or route-level cold-start profile was found.
- No evidence of edge/runtime selection per route.
- No explicit serverless concurrency control for high-cost dashboard or AI endpoints.
- No external synthetic checks for Vercel availability were found.

## Risk Level

High. Vercel can host the app, but the current repo does not prove that cron, cold starts, bundle size, duration limits, and serverless connection behavior are production-safe at scale.

## Recommendations

- Make `vercel.json` the canonical cron source or generate it from a checked-in schedule manifest.
- Add build artifact and bundle-size checks to CI.
- Add max duration and memory review for routes that aggregate dashboards, AI, graph, prediction, and command center workloads.
- Add synthetic checks for `/health`, `/health/ready`, `/health/worker`, and critical app pages.
- Validate production `DATABASE_URL` at deploy time for pooler settings.
- Add deployment protection: preview smoke tests, production promote step, and rollback procedure.

## Priority

P0 for cron drift. P1 for bundle/cold-start profiling and synthetic checks. P2 for route-level runtime tuning.

## Estimated Engineering Effort

3 to 6 days for P0/P1 controls; 1 to 2 weeks for complete route-level performance profiling.
