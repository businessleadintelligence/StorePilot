# RC1 Production Build Report

**Release:** v1.0.0-rc1  
**Date:** 2026-07-10  
**Gate:** RC Gate 5 — Clean Production Build  
**Status:** 🟡 **PASS WITH WARNINGS**

## Command

```bash
npm run build
```

## Result

| Metric | Value |
|--------|-------|
| Exit code | **0** |
| Build duration | **~29s** (wall clock) |
| Vite server build | **5.84s** |
| Prisma generate | success (v6.19.3) |
| Prompt copy script | success |

## Bundle sizes

| Asset | Size |
|-------|------|
| Server main bundle (`server-build-DT8kbd6Q.js`) | **2,546.60 kB** (~2.5 MB) |
| Server CSS (`server-build-CJcvViZT.css`) | **35.09 kB** |
| Total server output | **~2.62 MB** |
| Total client output | **~622 KB** |
| Client manifest | **24.50 kB** |

## Build steps verified

1. `prisma generate` — Prisma Client generated
2. `react-router build` — client + server bundles produced
3. `node scripts/copy-vercel-prompts.mjs` — 14 prompt markdown files copied to server build

## Warnings (non-fatal)

Vite emitted informational warnings:

- **Empty chunks** for server-only routes (health, webhooks, cron) — expected for React Router SSR
- **Dynamic import / static import overlap** for:
  - `app/db.server.ts`
  - `app/billing/billing-audit.ts`
  - `app/billing/billing-service.ts`
  - `app/knowledge/graph/nodes/node-store.ts`
  - `app/knowledge/graph/metrics/graph-metrics.ts`
  - `app/services/ai-cost-control.server.ts`

These are bundler optimization notices, not runtime failures. No missing imports or unresolved modules.

## Prisma deprecation notice

```
package.json#prisma is deprecated and will be removed in Prisma 7
```

Tracked as technical debt — does not block RC1 build.

## Certification

Production build **succeeds**. Strict "zero warnings" target is not met due to Vite chunk/import notices; runtime build integrity is confirmed.
