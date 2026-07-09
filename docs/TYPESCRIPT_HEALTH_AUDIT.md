# StorePilot — TypeScript Health Audit v1.0

**Date:** 2026-06-20  
**Mode:** READ-ONLY (no code changes)  
**Project path:** `store-pilot/`  
**Workspace root (Cursor):** `STOREPILOT/` (parent)

---

## Executive Summary

| Signal | Result |
|--------|--------|
| `npm run typecheck` | **0 TypeScript compiler errors** |
| `npx tsc --noEmit` | **0 errors** |
| `npm run build` | **PASS** |
| `npm test` | **2822 / 2822 PASS** |
| `npm run lint` (ESLint) | **158 problems** (108 errors, 50 warnings) |
| Cursor IDE ~266 red underlines | **Not genuine `tsc` failures** |

**Overall Health Score: 9.2 / 10** (compiler & production)  
**IDE Diagnostics Score: 6.5 / 10** (noisy ESLint + artifact indexing)

The codebase is **TypeScript-clean for CI and production**. The ~266 Cursor underlines are overwhelmingly **ESLint diagnostics** and **workspace indexing of excluded/recovery paths**, not blocking compiler errors.

**Production build is NOT affected.**

---

## Total Errors (by tool)

| Tool | Errors | Warnings | Notes |
|------|--------|----------|-------|
| TypeScript (`tsc`) | **0** | — | Authoritative for compile |
| ESLint | **108** | **50** | Shown as red/yellow in IDE |
| Recovery artifacts (if force-included) | **14+** | — | `_transcript-extract`, `backups/` |
| Parent-folder snapshot (`recovery-from-transcript/`) | **Potentially 100s** | — | 860 `.ts`/`.tsx` files; gitignored but may be indexed |

**Reconciling ~266 IDE count:** ESLint alone reports **158** issues. The gap to ~266 is explained by:

1. IDE **Problems panel** may count duplicate `import/export` violations multiple times per line (e.g. `app/ai/memory/index.ts` → 18 ESLint errors on 2 lines).
2. **ESLint warnings** (50) sometimes styled similarly to errors.
3. Opening or indexing **`_transcript-extract/`** (+11 ESLint, +13 `tsc` if excluded paths are analyzed).
4. **`recovery-from-transcript/`** at repo root (860 TS files) visible when workspace root is `STOREPILOT/` — not in `tsconfig` but TypeScript language service may still surface diagnostics on opened files.
5. **Stale language server** cache after large recovery sprint.

---

## Error Categories

### Category A — Broken imports (`import/no-unresolved`)

**Count:** 14 ESLint errors  
**Repair difficulty:** Low (delete artifacts) / Medium (fix test paths)  
**Risk:** Low  
**Affects production:** No

| File | Line | Error | Root cause |
|------|------|-------|------------|
| `_transcript-extract/additional-tools.test.ts` | 3–13 | Cannot resolve `../../agents/*`, `../../tools/*`, `./helpers` | Orphaned recovery extract; wrong relative paths |
| `app/components/executive/__tests__/ExecutiveDashboard.test.tsx` | 5 | Cannot resolve `../../components/executive/ExecutiveDashboard` | ESLint resolver path vs actual file location |
| `app/routes/__tests__/f56-executive-dashboard.test.tsx` | 2 | Cannot resolve `@testing-library/react` | ESLint import resolver lacks devDependency types |
| `backups/app._index.backup.tsx` | 9 | Cannot resolve `../shopify.server` | Backup file outside app tree |

**Suggested repair:** Delete or gitignore `_transcript-extract/` and `backups/` from ESLint scope; add `eslint-import-resolver` for test deps (optional).  
**Est. time:** 30 min

---

### Category B — Duplicate exports (`import/export`)

**Count:** 24 ESLint errors (4 files)  
**Repair difficulty:** Low  
**Risk:** Low (barrel `export *` pattern; `tsc` allows it)

| File | Lines | Root cause |
|------|-------|------------|
| `app/ai/memory/index.ts` | 1–2 | Double `export *` from same modules |
| `app/ai/recommendations/index.ts` | 1–2 | Double `export *` |
| `app/ai/tools/index.ts` | 113–114 | `calculateGrowthPriorityScore` exported twice |
| `app/connectors/index.ts` | 30, 34 | `DEFAULT_CACHE_TTL_MS` exported twice |

**Suggested repair:** Consolidate barrel exports to single `export *` per module.  
**Est. time:** 1 hour

---

### Category C — Generated Prisma / route types out of date

**Count:** 0 `tsc` errors  
**Status:** **Current**

| Artifact | Present | Notes |
|----------|---------|-------|
| `node_modules/.prisma/client/index.d.ts` | ✓ | Generated |
| `.react-router/types/+routes.ts` | ✓ | Created by `react-router typegen` |
| `postinstall` → `prisma generate` | ✓ | In `package.json` |

**No action required.**

---

### Category D — Unused imports / variables (`@typescript-eslint/no-unused-vars`)

**Count:** ~61 ESLint errors  
**Repair difficulty:** Low  
**Risk:** Very low  
**Affects production:** No (dead code warnings only)

**Most affected areas:**

| Area | Files | Examples |
|------|-------|----------|
| AI Platform | 15+ | `agent-registry.ts` (`z`), `ai-agent.ts` (`_facts`), fact builders |
| Tests | 20+ | Unused mocks, `vi`, `prisma`, fixture imports |
| Services | 8 | `command-center.server.ts`, `executive-dashboard.server.ts`, `store.server.ts` |
| Routes | 2 | `app._index.tsx` (5 unused imports) |
| vitest.setup.ts | 4 | Large mock file housekeeping |

**Suggested repair:** Remove unused imports/vars or prefix with `_` where intentional.  
**Est. time:** 2–3 hours (mechanical)

---

### Category E — Dead code

**Count:** Subset of Category D  
**Examples:** `isPhaseSynced` in `sync-display.ts`, `decryptSecretToken` import in `store.server.ts`, unused dashboard imports in `app._index.tsx`

**Risk:** Low  
**Est. time:** 1 hour (bundled with Category D)

---

### Category F — Circular imports

**Count:** 0 confirmed by `tsc`  
**Status:** No compiler circular dependency errors detected.

---

### Category G — Wrong path aliases

**Count:** 0 `tsc` errors  
**Config:** `baseUrl: "."`, `vite-tsconfig-paths` in `vite.config.ts` — working for build/typecheck.

ESLint `import/no-unresolved` false positives on test paths (Category A) are resolver config, not alias breakage.

---

### Category H — Recovery corruption remnants

**Count:** 14+ diagnostics when artifacts included  
**Repair difficulty:** Trivial (delete/exclude)  
**Risk:** None

| Path | TS files | Issue |
|------|----------|-------|
| `store-pilot/_transcript-extract/` | 1 | 11 broken imports (ESLint) + 13 `tsc` if included |
| `store-pilot/backups/` | 1 | Broken import backup route |
| `store-pilot/store-pilot/` | 14 | Nested duplicate tree (excluded in `tsconfig`) |
| `recovery-from-transcript/` (repo root) | **860** | Full duplicate snapshot; gitignored |
| `store-pilot.broken-backup/` | — | Gitignored |

**`tsconfig.json` excludes:** `backups`, `store-pilot`, `_transcript-extract` ✓  
**ESLint does NOT exclude** `_transcript-extract` or `backups` (uses `.gitignore` which omits them).

**Suggested repair:** Add `_transcript-extract`, `backups`, `store-pilot/store-pilot` to `.eslintignore` or delete artifacts.  
**Est. time:** 15 min

---

### Category I — Language server / IDE cache

**Count:** Unknown (stale duplicates)  
**Evidence:** `tsc` = 0 while IDE shows hundreds of underlines.

**Recommend (only if underlines persist after ESLint cleanup):**

1. Open workspace folder as **`store-pilot/`** not parent `STOREPILOT/`
2. Command Palette → **TypeScript: Restart TS Server**
3. Delete `store-pilot/node_modules/.cache/eslint`
4. Run `npx react-router typegen` once
5. Reload Cursor window

**Do NOT delete `node_modules` unless corruption suspected** — not necessary today.

---

### Category J — ESLint only (not TypeScript compiler)

**Count:** 108 errors + 50 warnings = **158 total**  
**Primary source of IDE red underlines**

| Rule | Count | Severity |
|------|-------|----------|
| `@typescript-eslint/no-unused-vars` | ~61 | error |
| `import/export` (duplicate exports) | ~24 | error |
| `import/no-unresolved` | ~14 | error |
| `import/no-duplicates` | ~25 | warning |
| `@typescript-eslint/no-var-requires` | 3 | error |
| `@typescript-eslint/no-non-null-asserted-optional-chain` | 2 | error |
| `prefer-const` | 2 | error |
| `react/no-unescaped-entities` | 1 | error |
| `no-extra-semi` | 1 | error |

**`npm run lint` is not in CI gate** — tests and typecheck are.

---

### Category K — False positives

| File | Issue | Why false positive |
|------|-------|-------------------|
| `f56-executive-dashboard.test.tsx` | `@testing-library/react` unresolved | ESLint import resolver; Vitest runs fine |
| `ExecutiveDashboard.test.tsx` | Component path unresolved | Relative path valid for Vitest/`tsc` |
| Duplicate export ESLint | `import/export` | Valid TypeScript; ESLint stricter than `tsc` |

---

## Configuration Verification

### `tsconfig.json`

| Setting | Value | Assessment |
|---------|-------|------------|
| `strict` | `true` | ✓ |
| `moduleResolution` | `Bundler` | ✓ Correct for Vite/React Router |
| `include` | `**/*.ts`, `**/*.tsx`, `.react-router/types` | ✓ |
| `exclude` | `node_modules`, `build`, `backups`, `store-pilot`, `_transcript-extract` | ✓ Recovery paths excluded |
| `rootDirs` | `.`, `./.react-router/types` | ✓ Route typegen |
| Path aliases | `baseUrl: "."` only | No `@/` alias — consistent |

**Missing:** `tsconfig.node.json` — not present; not required (single config).

### `package.json`

| Script | Purpose | Status |
|--------|---------|--------|
| `typecheck` | `react-router typegen && tsc --noEmit` | ✓ Pass |
| `build` | `prisma generate && react-router build` | ✓ Pass |
| `lint` | ESLint | 158 issues (non-blocking) |

### `vite.config.ts`

- Uses `@react-router/dev/vite`, `vite-tsconfig-paths` — aligned with `tsconfig.json` ✓

### Workspace structure issues

| Check | Finding |
|-------|---------|
| Duplicate `store-pilot/store-pilot/` | 14 TS files — excluded from `tsc` |
| `recovery-from-transcript/` at repo root | 860 TS files — gitignored, **IDE risk if parent folder open** |
| Multiple `tsconfig.json` | Only one (in `store-pilot/`) |
| Multiple Prisma clients | One (`node_modules/.prisma/client`) |
| Nested `node_modules` | 80 nested dirs (normal for npm) |
| `tsconfig` at repo root | **None** — parent workspace has no TS project boundary |

---

## Files Most Affected (ESLint)

| Rank | File | ESLint issues |
|------|------|---------------|
| 1 | `app/ai/memory/index.ts` | 18 |
| 2 | `_transcript-extract/additional-tools.test.ts` | 11 |
| 3 | `app/routes/app._index.tsx` | 5 |
| 4 | `app/services/__tests__/setup/vitest.setup.ts` | 4 |
| 5 | `app/services/executive-dashboard.server.ts` | 4 |
| 6 | `app/services/__tests__/f64-fix-c2.test.ts` | 4 |
| 7 | `app/ai/tests/seo-intelligence/v1-matrix.test.ts` | 4 |

---

## High-Risk vs Low-Risk Issues

### High-risk (blocking) — **NONE**

No `tsc` errors. Build and tests pass.

### Medium-risk (quality / App Store perception)

- Unused imports in `app._index.tsx` (may indicate incomplete loader wiring — runtime may still work via other paths)
- ESLint `no-var-requires` in `operations-engine.ts`, `production-engine.ts` (dynamic requires)

### Low-risk (cosmetic / IDE noise)

- 61 unused variable warnings
- 24 duplicate export barrel warnings
- 25 duplicate import warnings
- Recovery artifact folders

---

## Recommended Repair Order

| Priority | Action | Est. time | Impact |
|----------|--------|-----------|--------|
| 1 | Open `store-pilot/` as workspace root; restart TS server | 5 min | May clear ~50% IDE noise |
| 2 | Exclude/delete `_transcript-extract`, `backups`, nested `store-pilot/` from ESLint | 15 min | −12 ESLint errors |
| 3 | Fix duplicate barrel exports (4 files) | 1 hr | −24 ESLint errors |
| 4 | Mechanical unused import cleanup | 2–3 hr | −61 ESLint errors |
| 5 | ESLint resolver for test dependencies | 30 min | −2 false positives |
| 6 | Optional: add `npm run lint` to CI as warning-only | 30 min | Prevent regression |

**Total estimated repair:** 4–6 hours (all low risk, no architecture changes)

---

## Production Build Impact

| Gate | Affected? |
|------|-----------|
| `npm run build` | **No** — passes |
| `npm run typecheck` | **No** — 0 errors |
| `npm test` | **No** — 2822/2822 |
| Vercel deploy | **No** — uses build script, not ESLint |
| Runtime merchant app | **No** |

---

## Appendix A — Complete ESLint Error Inventory (108)

<details>
<summary>All 108 ESLint errors by file (click to expand)</summary>

| File | Line | Rule | Message |
|------|------|------|---------|
| `_transcript-extract/additional-tools.test.ts` | 3 | import/no-unresolved | `../../agents/executive-coo-evidence` |
| `_transcript-extract/additional-tools.test.ts` | 4 | import/no-unresolved | `../../agents/executive-coo-impact` |
| `_transcript-extract/additional-tools.test.ts` | 5–12 | import/no-unresolved | executive-coo tools (8 imports) |
| `_transcript-extract/additional-tools.test.ts` | 13 | import/no-unresolved | `./helpers` |
| `app/ai/agents/agent-registry.ts` | 1 | no-unused-vars | `z` unused |
| `app/ai/cache/fingerprint.ts` | 68 | no-unused-vars | `_computedAt` unused |
| `app/ai/core/ai-agent.ts` | 41–42 | no-unused-vars | `_facts`, `_output` unused |
| `app/ai/facts/inventory-facts.ts` | 32 | no-unused-vars | `estimateInventoryRecommendationImpact` |
| `app/ai/facts/seo-intelligence-facts.ts` | 28 | no-unused-vars | `calculateSeoHealthScore` |
| `app/ai/facts/store-audit-facts.ts` | 5 | no-unused-vars | `getRevenueMetrics` |
| `app/ai/facts/trend-facts.ts` | 11 | no-unused-vars | `calculateMomentum` |
| `app/ai/memory/index.ts` | 1–2 | import/export | 18× duplicate export names |
| `app/ai/persistence/types.ts` | 134 | no-unused-vars | `T` unused |
| `app/ai/providers/index.ts` | 4 | no-unused-vars | `OpenAIProvider` unused |
| `app/ai/recommendations/index.ts` | 1–2 | import/export | `RecommendationStatus` ×2 |
| `app/ai/schemas/index.ts` | 5 | no-unused-vars | `CollaborationOutputSchema` unused |
| `app/ai/tests/ai-runner.test.ts` | 3, 9 | no-unused-vars | `z`, `AIStructuredResponse` |
| `app/ai/tests/collaboration/collaboration-engine.test.ts` | 12 | no-unused-vars | `CollaborationRecommendationInput` |
| `app/ai/tests/pricing-intelligence/v1-matrix.test.ts` | 7 | no-unused-vars | `analyzePricingElasticity` |
| `app/ai/tests/seo-intelligence/v1-matrix.test.ts` | 12–14 | no-unused-vars | 3 analyze functions |
| `app/ai/tools/index.ts` | 113–114 | import/export | `calculateGrowthPriorityScore` ×2 |
| `app/ai/tools/seo-technical-tool.ts` | 1 | no-unused-vars | `SeoEstimatedImpact` |
| `app/automation/automation-engine.ts` | 173 | prefer-const | `automation` should be const |
| `app/automation/automation-metrics.ts` | 8 | no-unused-vars | `total` |
| `app/billing/__tests__/billing-config-consistency.test.ts` | 70 | no-unused-vars | `forbiddenPatterns` |
| `app/billing/billing-service.ts` | 8 | no-unused-vars | `mapDbPlanSlugToCommercial` |
| `app/components/billing/BillingDashboard.tsx` | 110 | react/no-unescaped-entities | unescaped `'` |
| `app/components/executive/__tests__/ExecutiveDashboard.test.tsx` | 5 | import/no-unresolved | ExecutiveDashboard path |
| `app/connectors/index.ts` | 30, 34 | import/export | `DEFAULT_CACHE_TTL_MS` ×2 |
| `app/google/__tests__/google-oauth.test.ts` | 1 | no-unused-vars | `vi` |
| `app/lib/__tests__/production-hardening.test.ts` | 1 | no-unused-vars | `vi` |
| `app/lib/sync-display.ts` | 25 | no-unused-vars | `isPhaseSynced` |
| `app/microsoft/__tests__/clarity-http.test.ts` | 1 | no-unused-vars | `vi` |
| `app/onboarding/__tests__/onboarding-progress.test.ts` | 1 | no-unused-vars | `beforeEach` |
| `app/onboarding/onboarding-dashboard.ts` | 157 | no-unused-vars | `syncStatus` |
| `app/operations/operations-engine.ts` | 198 | no-var-requires | require() |
| `app/production/production-engine.ts` | 101–102 | no-var-requires | require() ×2 |
| `app/production/production-sync-monitor.ts` | 7 | no-unused-vars | `levelFromFailureCount` |
| `app/routes/__tests__/f45-dashboard-onboarding.test.ts` | 4 | no-unused-vars | `prisma` |
| `app/routes/__tests__/f56-executive-dashboard.test.tsx` | 2 | import/no-unresolved | `@testing-library/react` |
| `app/routes/app._index.tsx` | 7–8, 46, 48–49 | no-unused-vars | 5 unused imports |
| `app/routes/internal.founder.tsx` | 29 | no-extra-semi | unnecessary semicolon |
| `app/services/__tests__/f0-orders-regression.test.ts` | 55, 152 | no-non-null-asserted-optional-chain | unsafe `!` |
| `app/services/__tests__/f22-webhook-retry-taxonomy.test.ts` | 10–11 | no-unused-vars | mock helpers |
| `app/services/__tests__/f49-executive-brief.test.ts` | 8–9 | no-unused-vars | brief builders |
| `app/services/__tests__/f53-entitlements.test.ts` | 8 | no-unused-vars | `recordUsage` |
| `app/services/__tests__/f54-ai-cost-control.test.ts` | 17 | no-unused-vars | `recordUsage` |
| `app/services/__tests__/f60a-webhook-store-eligibility.test.ts` | 3 | no-unused-vars | `STORE_ID` |
| `app/services/__tests__/f60a-worker-orders-blocked.test.ts` | 4 | no-unused-vars | `ORDER_GID` |
| `app/services/__tests__/f610-foundation-blockers.test.ts` | 35 | no-unused-vars | `webhookServer` |
| `app/services/__tests__/f64-fix-c2.test.ts` | 14–15, 19, 413 | no-unused-vars | mocks/args |
| `app/services/__tests__/google-integration.test.ts` | 1, 3 | no-unused-vars | `vi`, `SHOP` |
| `app/services/__tests__/setup/vitest.setup.ts` | 1762, 2011, 2813, 3260 | no-unused-vars | mock internals |
| `app/services/command-center.server.ts` | 43 | no-unused-vars | `formatRelativeTime` |
| `app/services/executive-dashboard.server.ts` | 655, 772, 839, 928 | no-unused-vars | `index` param |
| `app/services/store.server.ts` | 5 | no-unused-vars | `decryptSecretToken` |
| `app/services/trend-intelligence-facts.server.ts` | 46 | no-unused-vars | `variantToProductId` |
| `app/shopify.server.ts` | 65 | prefer-const | `shopifyAppInstance` |
| `backups/app._index.backup.tsx` | 9 | import/no-unresolved | `../shopify.server` |

</details>

---

## Appendix B — TypeScript Compiler Errors

**None.** `npm run typecheck` completed with exit code 0 and zero diagnostic lines.

---

## Conclusion

StorePilot v1.0 is **compiler-healthy**. The reported ~266 IDE underlines are **not production blockers** and are primarily:

1. **ESLint** style/quality rules (158 issues) surfaced in the editor
2. **Recovery artifact folders** not fully excluded from ESLint / IDE indexing
3. **Parent workspace root** (`STOREPILOT/`) exposing gitignored duplicate snapshots

No Prisma, schema, route, or agent code changes are required for TypeScript correctness. Recommended first step: **open `store-pilot/` as the Cursor workspace folder** and restart the TypeScript server.
