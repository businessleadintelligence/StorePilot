# RC1 Production Bundle Verification

**Release:** v1.0.0-rc1  
**Date:** 2026-07-10  
**Gate:** RC Gate 6 — Production Bundle Verification  
**Status:** ✅ **PASS**

## Build output inspected

Path: `build/` (post `npm run build`)

## Runtime resource checklist

| Resource | Expected | Verified | Location |
|----------|----------|----------|----------|
| Prompt registry | present | ✅ | Bundled in `server-build-DT8kbd6Q.js` |
| Prompt markdown files | 14 | ✅ | `build/server/app/ai/prompts/*.md` (+ nodejs runtime mirror) |
| Prompt loaders | present | ✅ | `file-prompt-loader.ts`, `prompt-loader.ts` in build |
| Prisma Client | generated | ✅ | `node_modules/@prisma/client` at build time |
| Prisma migrations | in repo | ✅ | 36 migrations in `prisma/migrations/` (deployed separately via `migrate deploy`) |
| Worker entry | present | ✅ | `scripts/worker.ts` + `app/services/worker.server.ts` in server bundle |
| Health endpoints | present | ✅ | Route chunks: `health`, `health.ready`, `health.worker`, `health.monitor`, `health.live` |
| Shopify config | present | ✅ | `app/lib/shopify-app-config.ts` in server bundle graph |
| App Bridge / Polaris | present | ✅ | Client chunks include Shopify app shell |
| CSS | present | ✅ | 7 client CSS assets + server CSS |
| Client manifest | present | ✅ | `build/client/.vite/manifest.json` |
| Server manifest | present | ✅ | `build/server/nodejs_*/.vite/manifest.json` |
| Static JS assets | present | ✅ | 80+ client route/feature chunks |
| Images / fonts / icons | N/A minimal | ✅ | No missing referenced assets in manifest |

## Prompt inventory (14 files)

1. `RootCauseExplanation.md`
2. `DailyOperatingPlan.md`
3. `ExecutiveBriefing.md`
4. `executive-coo.md`
5. `platform.template.md`
6. `product-intelligence.md`
7. `bundle-discovery.md`
8. `inventory-intelligence.md`
9. `trend-intelligence.md`
10. `store-audit.md`
11. `seo-intelligence.md`
12. `pricing-intelligence.md`
13. `growth-intelligence.md`
14. `collaboration-engine.md`

## Startup readiness (static analysis)

| Check | Result |
|-------|--------|
| Server entry (`build/server/nodejs_*/index.js`) | ✅ exists |
| No unresolved prompt imports | ✅ copy script succeeded |
| Intelligence modules in bundle | ✅ executive, prediction, experiment, merchant, knowledge graph paths compiled |
| Foundation client | ✅ included in server bundle |
| Worker compile path | ✅ worker.server compiled into server bundle |

## Notes

- Migrations are **not** embedded in the Vercel bundle — correct; applied via `prisma migrate deploy` against production `DATABASE_URL`
- Dual prompt paths exist (`build/server/app/ai/prompts/` and `build/server/nodejs_*/app/ai/prompts/`) — copy script targets both for Vercel + Node runtime compatibility

## Certification

Production bundle contains all required runtime resources for RC1 startup. Bundle verification is **GREEN**.
