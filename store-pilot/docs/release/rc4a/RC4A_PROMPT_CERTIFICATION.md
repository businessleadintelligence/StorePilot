# RC4A Step 7 — Prompt Bundle Certification

**Date:** 2026-07-10  
**Status:** ✅ **PASS** (local)

## Required prompts (13)

From `validateFoundationPromptRegistry()` + agent registry.

All 13 `.md` files present in `app/ai/prompts/` with version metadata.

## Bundled prompts (14)

| # | Prompt ID | Version |
|---|-----------|---------|
| 1 | ExecutiveBriefing | 1.0.0 |
| 2 | DailyOperatingPlan | 1.0.0 |
| 3 | RootCauseExplanation | 1.0.0 |
| 4 | platform.template | 1.0.0 |
| 5 | product-intelligence | 2.0.0 |
| 6 | inventory-intelligence | 1.0.0 |
| 7 | bundle-discovery | 1.0.0 |
| 8 | store-audit | 1.0.0 |
| 9 | trend-intelligence | 1.0.0 |
| 10 | seo-intelligence | 1.0.0 |
| 11 | pricing-intelligence | 1.0.0 |
| 12 | growth-intelligence | 1.0.0 |
| 13 | executive-coo | 1.0.0 |
| 14 | collaboration-engine | 1.0.0 (auxiliary) |

## Verification

| Check | Result |
|-------|--------|
| Source count | **14** |
| Post-build count (`build/server/app/ai/prompts/`) | **14** |
| Duplicate IDs | **0** |
| Copy script | ✅ `scripts/copy-vercel-prompts.mjs` |
| Runtime path resolution | ✅ `resolveDefaultPromptsDirectory()` in `prompt-registry/store.ts` |
| SHA-256 checksum | `8b81ab0db7e3e4b21ead6c8a5534539c7f7f30aaffc597234859404b6c761ff2` |
| Production (current) | ❌ All 13 required missing — **old deploy** |

## Worker bundle

`Dockerfile.worker` runs full `npm run build` → prompts copied into `build/server/...` inside image.

## Verdict

**PASS** locally — production verification pending RC4 deploy.
