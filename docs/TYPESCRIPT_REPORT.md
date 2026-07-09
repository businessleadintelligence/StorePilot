# StorePilot — TypeScript Health Report

**Date:** 2026-07-09  
**Config:** `store-pilot/tsconfig.json` (strict mode enabled)

---

## Summary

| Metric | Value |
|--------|------:|
| **TypeScript errors** | **0** |
| Files included | 924 TS/TSX in `app/` |
| `strict` | `true` |
| `noEmit` | `true` |
| Excluded | `node_modules`, `build`, `backups`, `_transcript-extract` |

---

## Verification

```bash
cd store-pilot && npm run typecheck
# react-router typegen && tsc --noEmit
# Exit code: 0 (2026-07-09)
```

---

## Issues found and resolved

### 1. `health.test.ts` — loader signature mismatch

**Error:** `Expected 0 arguments, but got 1` for `liveLoader`, `readyLoader`, `monitorLoader`.

**Fix:** Call loaders with no arguments (they take no `LoaderFunctionArgs`).

### 2. `operations-engine.ts` — value imported as type

**Error:** Runtime `ReferenceError: KANBAN_COLUMNS is not defined` (caught by tests).

**Cause:** `KANBAN_COLUMNS` was in `import type { ... }` block.

**Fix:**
```typescript
import {
  KANBAN_COLUMNS,
  type CreateOperationInput,
  type KanbanColumn,
  ...
} from "./operations-types";
```

### 3. `trend-intelligence/helpers.ts` — `never` type in ternary

**Error:** `Property 'title' does not exist on type 'never'`.

**Cause:** Redundant ternary inside `if (declining)` block narrowed else branch to `never`.

**Fix:** Removed dead ternary branch.

### 4. `cron-scheduler.test.ts` — LoaderFunctionArgs cast

**Fix:** `as unknown as Parameters<typeof dispatchLoader>[0]` for partial mock args.

---

## TypeScript configuration

```json
{
  "strict": true,
  "isolatedModules": true,
  "noEmit": true,
  "moduleResolution": "Bundler",
  "target": "ES2022",
  "jsx": "react-jsx"
}
```

---

## Import / export audit

| Issue | Resolution |
|-------|------------|
| Duplicate `calculateGrowthPriorityScore` export | Fixed in `ai/tools/index.ts` |
| Duplicate memory registry exports | Fixed in `ai/memory/index.ts` |
| Duplicate `RecommendationStatus` export | Removed from `recommendation-engine.ts` |
| Duplicate `DEFAULT_CACHE_TTL_MS` | Removed re-export from `connector-sync-engine.ts` |
| `require()` in TS modules | Converted to ESM imports |

No remaining broken imports detected by `tsc --noEmit`.

---

## Nullable / async patterns

- Prisma calls consistently use `async/await`
- Shopify SDK session types used from `@shopify/shopify-api`
- AI platform uses typed `FactBuilder<T>` generics
- Zod schemas in `app/ai/schemas/` for structured output validation

No `implicit any` errors in strict mode after stabilization.
