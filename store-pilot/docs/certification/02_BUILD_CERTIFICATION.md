# 02 — Build Certification

**Date:** 2026-07-10T09:02Z  
**Status:** 🟡 **PARTIAL PASS**

## Commands executed

| Command | Exit | Result |
|---------|------|--------|
| `npm test` | 0 | 🟢 280 files, **3033/3033** pass (67s) |
| `npm run build` | 0 | 🟢 Success (20s) |
| `npm run typecheck` | 2 | 🔴 **~120 TS errors** |
| `npm run lint` | 1 | 🔴 **92 problems** (90 errors, 2 warnings) |

## Typecheck failures (summary)

Primary file: `app/services/intelligence-workspace-views.tsx` and `intelligence-workspace.server.ts`

- Duplicate exports: `IntelligenceWorkspaceLoaderData`, `IntelligenceWorkspacePayload`
- Type `never` inference errors in workspace views

**Log:** `.cert-typecheck.log`

## Lint failures (summary)

- 90 errors across codebase (unused vars, duplicate exports, import/export)
- Notable: `job.server.ts`, `worker.server.ts` unused imports

**Log:** `.cert-lint.log`

## Build output verification

| Asset | Status | Evidence |
|-------|--------|----------|
| Server bundle | 🟢 | `build/server/nodejs_*/assets/server-build-*.js` (~2.5 MB) |
| Client bundle | 🟢 | `build/client/` |
| Prompts (flat) | 🟢 | `build/server/app/ai/prompts/` — **14 .md files** |
| Prompts (hashed bundle) | 🟢 | `build/server/nodejs_*/app/ai/prompts/` — **14 files** |
| Copy script | 🟢 | `Copied AI prompt files into server build output` |
| Migrations in bundle | 🟡 | Not bundled to serverless (expected); readiness uses DB check |
| Worker entry | 🟢 | `scripts/worker.ts` exists (untracked) |
| Health routes | 🟢 | `app/routes/health*.tsx` present |

## Prompt registry (via tests)

`foundation-prompt-validation.test.ts` passes in vitest suite (3033 tests include it).

Direct `node -e import(...)` failed — requires tsx/bundler (not a production issue).

## Warnings (non-blocking)

- Vite dynamic import warnings (billing-service, graph modules, ai-cost-control)

## Required actions before GREEN

1. Fix typecheck errors in `intelligence-workspace*.ts(x)`
2. Fix lint errors (or document accepted debt with waiver — **not recommended for launch**)
3. Re-run: `npm run typecheck && npm run lint && npm test && npm run build`

## Certification result

**NOT CERTIFIED** — build and tests pass; typecheck and lint fail.
