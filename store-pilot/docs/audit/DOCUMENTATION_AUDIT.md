# Documentation Audit — StorePilot Phase A

**Date:** 2026-07-10

---

## Summary

**81 markdown files** in `docs/` covering architecture, engines, workers, privacy, and Shopify compliance. Documentation is **above average** for a pre-launch SaaS platform.

---

## Documentation Coverage

| Area | Docs | Quality |
|------|------|---------|
| Knowledge Graph | 7 files (GRAPH_*, STORE_KNOWLEDGE_GRAPH) | ✅ Excellent |
| Learning / Business Memory | 10+ files | ✅ Excellent |
| Executive Platform | 8 files | ✅ Excellent |
| Root Cause / Causal | 6 files | ✅ Excellent |
| Prediction / Prevention | 4 files | ✅ Good |
| Experiments | 7 files | ✅ Good |
| Merchant Intelligence | 8 files | ✅ Good |
| AI Platform | 5 files (Foundation, routing, prompts, cost) | ⚠️ Conflicting with V2 |
| Workers | 4 files (architecture, lifecycle, deployment) | ✅ Good |
| Privacy / Shopify | 4 files (PRIVACY_BY_ARCHITECTURE, scopes, webhooks, app store) | ✅ Good |
| Database | 2 files (PRISMA_AUDIT, DATABASE_SCALABILITY) | ✅ Good |
| Production | 2 files (installation verification, repo structure) | ✅ Good |
| Sprint 10 Frontend | ❌ Not yet documented | Gap |
| API reference | ❌ No OpenAPI/generated API docs | Gap |
| Developer onboarding | Partial (README + docs scatter) | Gap |
| Deployment runbook | Partial (F42 worker cron deployment) | Gap |

---

## Conflicts & Staleness

| Issue | Files |
|-------|-------|
| AI Foundation vs V2 orchestrator as canonical entry | `AI_PLATFORM_FOUNDATION.md` vs `PLATFORM_V2.md` |
| Foundation migration checklist incomplete | `AI_PLATFORM_FOUNDATION.md` line 170 unchecked |
| `/health/ai-foundation` documented as TODO | Foundation observability doc |
| Executive COO dual path not documented | Missing architecture decision record |
| Sprint 10 intelligence-ui not documented | New `app/intelligence-ui/` module |

---

## Missing Documentation (Recommended)

| Document | Purpose |
|----------|---------|
| `docs/INTELLIGENCE_WORKSPACE_UX.md` | Sprint 10 workspace architecture |
| `docs/AI_STACK_MIGRATION.md` | V2 → Foundation migration plan |
| `docs/GDPR_DELETION_MATRIX.md` | All tables + deletion order for shop/redact |
| `docs/DEVELOPER_ONBOARDING.md` | Local setup, env vars, worker, tests |
| `docs/DEPLOYMENT_RUNBOOK.md` | Vercel + worker + migrations + rollback |
| `docs/adr/` | Architecture decision records |

---

## Phase A Audit Docs (This Sprint)

Created in `docs/audit/` — 18 reports forming the engineering baseline.

---

## Score: 88/100

Rich domain documentation. Deductions for AI stack conflicts, missing onboarding/runbook, and Sprint 10 gap.
