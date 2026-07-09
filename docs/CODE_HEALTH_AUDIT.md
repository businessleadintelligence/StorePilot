# StorePilot — Code Health Audit

**Sprint:** Production Stabilization  
**Date:** 2026-07-09  
**Scope:** `store-pilot/` full repository

---

## Repository inventory

| Category | Count | Verified |
|----------|------:|:--------:|
| TypeScript/TSX files (`app/`) | 924 | ☑ |
| Test files (`*.test.ts(x)`) | 261 | ☑ |
| React Router route modules | 70 | ☑ |
| Prisma migrations | 22 | ☑ |
| Production dependencies | 17 | ☑ |
| Dev dependencies | 19 | ☑ |
| AI agent modules | 12+ agents | ☑ |
| Webhook routes | 13 | ☑ |
| Cron schedules | 9 | ☑ |

### Top-level structure

```
store-pilot/
├── app/
│   ├── ai/           # AI platform (agents, tools, schemas, orchestrator)
│   ├── routes/       # React Router routes (app, webhooks, cron, health)
│   ├── services/     # Business logic layer
│   ├── operations/   # Operations engine
│   ├── connectors/   # GA4, GSC, Clarity connectors
│   ├── billing/      # Shopify billing
│   ├── components/   # UI components
│   ├── lib/          # Shared utilities, logging
│   └── production/   # Production health engine
├── prisma/           # Schema + 22 migrations
├── docs/             # Sprint documentation
└── vercel.json       # Production deployment config
```

---

## Gate results (verified 2026-07-09)

| Gate | Command | Result |
|------|---------|--------|
| TypeScript | `npm run typecheck` | **PASS** (0 errors) |
| ESLint | `npm run lint` | **PASS** (0 errors, 0 warnings) |
| Tests | `npm test` | **PASS** (2864/2864) |
| Build | `npm run build` | **PASS** |
| Prisma schema | `npx prisma validate` | **PASS** |
| Prisma client | `npx prisma generate` | **PASS** |

---

## Fixes applied this sprint

### TypeScript / runtime bugs

| Issue | File | Fix |
|-------|------|-----|
| `KANBAN_COLUMNS is not defined` | `operations-engine.ts` | Value import separated from type import |
| `require()` in ESM module | `operations-engine.ts`, `production-engine.ts` | Converted to static imports |
| Trend test helper contradictions | `ai/tests/trend-intelligence/helpers.ts` | Facts-aligned dynamic draft builder |
| Growth ranking duplicate export | `ai/tools/index.ts` | Explicit exports, no duplicate symbol |
| Memory barrel duplicate exports | `ai/memory/index.ts` | Named exports only |
| Connector cache duplicate export | `connector-sync-engine.ts` | Removed re-export of `DEFAULT_CACHE_TTL_MS` |

### ESLint (159 → 0)

- Removed 50+ unused imports across AI, services, tests
- Fixed duplicate barrel exports (memory, recommendations, tools, connectors)
- Fixed `react/no-unescaped-entities` in BillingDashboard
- Fixed `no-non-null-asserted-optional-chain` in order regression tests
- Replaced `@testing-library/react` with `renderToString` in f56 test (dep not installed)
- Removed unused imports from `app._index.tsx`
- Added `_` prefix ignore pattern for intentionally unused params

### Dead code removed

| Item | Action |
|------|--------|
| `_transcript-extract/` | Deleted (broken recovery artifacts) |
| `backups/app._index.backup.tsx` | Deleted |
| `isPhaseSynced` in sync-display.ts | Removed (unused) |
| Multiple unused fact-tool imports | Removed |

### Tests fixed

| Suite | Before | After |
|-------|-------:|------:|
| Full suite | 2860/2864 | **2864/2864** |
| Trend intelligence | 4 failures | 0 |
| Growth intelligence | 11 failures (regression) | 0 |
| Operations comprehensive | 1 failure | 0 |

---

## Remaining non-code blockers

| Item | Status |
|------|--------|
| Supabase database reachable | **BLOCKED** — tenant not found |
| Vercel deploy of sprint infrastructure | **Not deployed** |
| `TOKEN_ENCRYPTION_KEY` / `CRON_SECRET` in production | **Unverified** |

See `PRODUCTION_CHECKLIST.md` and `PRODUCTION_READINESS_REPORT.md`.

---

## Architecture boundaries

| Layer | Location | Responsibility |
|-------|----------|----------------|
| Routes | `app/routes/` | HTTP entry, loaders, actions |
| Services | `app/services/` | Business logic, orchestration |
| AI Platform | `app/ai/` | Agent execution, schemas, tools |
| Persistence | Prisma + `app/ai/persistence/` | Data access |
| Connectors | `app/connectors/` | External API integrations |
| Infrastructure | `app/lib/`, `app/production/` | Logging, health, utilities |

No circular dependency tooling was run; manual audit of barrel exports and import paths found no blocking cycles after fixes.
