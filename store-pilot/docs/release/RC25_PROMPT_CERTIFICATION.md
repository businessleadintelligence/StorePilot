# RC2.5 Prompt Certification

**Date:** 2026-07-10  
**Phase:** RC2.5 Step 5  
**Status:** ✅ **PASS**

## Required registry prompts (13)

Validated by `validateFoundationPromptRegistry()` and `foundation-prompt-validation.test.ts`.

| Prompt ID | File | Version | Referenced by | Bundled |
|-----------|------|---------|---------------|---------|
| ExecutiveBriefing | `ExecutiveBriefing.md` | 1.0.0 | Foundation | ✅ |
| DailyOperatingPlan | `DailyOperatingPlan.md` | 1.0.0 | Foundation | ✅ |
| RootCauseExplanation | `RootCauseExplanation.md` | 1.0.0 | Foundation | ✅ |
| platform.template | `platform.template.md` | 1.0.0 | platform_template agent | ✅ |
| product-intelligence | `product-intelligence.md` | 2.0.0 | product_intelligence | ✅ |
| inventory-intelligence | `inventory-intelligence.md` | 1.0.0 | inventory_intelligence | ✅ |
| bundle-discovery | `bundle-discovery.md` | 1.0.0 | bundle_discovery | ✅ |
| store-audit | `store-audit.md` | 1.0.0 | store_audit | ✅ |
| trend-intelligence | `trend-intelligence.md` | 1.0.0 | trend_intelligence | ✅ |
| seo-intelligence | `seo-intelligence.md` | 1.0.0 | seo_audit | ✅ |
| pricing-intelligence | `pricing-intelligence.md` | 1.0.0 | pricing_intelligence | ✅ |
| growth-intelligence | `growth-intelligence.md` | 1.0.0 | growth_intelligence | ✅ |
| executive-coo | `executive-coo.md` | 1.0.0 | executive_coo | ✅ |

## Auxiliary bundled prompt (1)

| Prompt ID | File | Version | Notes |
|-----------|------|---------|-------|
| collaboration-engine | `collaboration-engine.md` | 1.0.0 | Privacy-whitelisted; rule-based engine (not in required registry) |

## Bundle verification

| Check | Result |
|-------|--------|
| Source count (`app/ai/prompts/*.md`) | **14** |
| Build count (`build/server/app/ai/prompts/*.md`) | **14** |
| Duplicate prompt IDs | **0** |
| Missing required prompts | **0** |
| Copy script | ✅ `scripts/copy-vercel-prompts.mjs` |

## Checksum (SHA-256, all 14 prompt files)

```
8b81ab0db7e3e4b21ead6c8a5534539c7f7f30aaffc597234859404b6c761ff2
```

Matches RC1/RC2 checksum — **no drift**.

## Test evidence

```bash
npm test -- app/services/__tests__/foundation-prompt-validation.test.ts
# Test Files  1 passed (1)
# Tests       1 passed (1)
```

## Certification

**RC2.5 Step 5: PASS**
