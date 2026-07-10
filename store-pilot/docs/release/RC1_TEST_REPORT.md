# RC1 Test Regression Report

**Release:** v1.0.0-rc1  
**Date:** 2026-07-10  
**Gate:** RC Gate 4 — Full Regression Validation  
**Status:** ✅ **PASS**

## Command

```bash
npm test
```

## Result

| Metric | Value |
|--------|-------|
| Test files | **280 passed** (280 total) |
| Tests | **3033 passed** (3033 total) |
| Failed | **0** |
| Skipped | **0** |
| Duration | **89.52s** |
| Vitest version | 4.1.9 |
| Exit code | **0** |

## Breakdown

```
Test Files  280 passed (280)
     Tests  3033 passed (3033)
  Duration  89.52s (transform 97.11s, setup 110.51s, import 411.52s, tests 78.62s)
```

## Post-fix validation

Tests re-run after:

- Intelligence workspace type consolidation
- ESLint stabilization across knowledge / learning / root-cause / routes
- Knowledge graph test mock refactor (removed `@ts-nocheck`)

No assertion weakening. No skipped tests added.

## Regression modules (test coverage present)

| Module | Verified |
|--------|----------|
| Knowledge Graph | ✅ `knowledge-graph.test.ts` |
| Business Memory | ✅ intelligence workspace tests |
| Executive Engine | ✅ executive dashboard / workspace tests |
| Prediction Engine | ✅ prediction tests |
| Experiment Engine | ✅ experiment tests |
| Merchant Intelligence | ✅ workspace / route tests |
| Dashboard routes | ✅ F56/F57/F58 route tests |
| Billing | ✅ billing tests |
| Shopify auth | ✅ auth route tests |
| Worker | ✅ worker / graceful shutdown tests |
| Health endpoints | ✅ system health tests |
| Foundation / prompts | ✅ foundation / prompt registry tests |

## Certification

Test gate is **GREEN** for RC1.
