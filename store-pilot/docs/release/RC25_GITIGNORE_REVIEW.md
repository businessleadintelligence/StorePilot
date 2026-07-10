# RC2.5 .gitignore Review

**Date:** 2026-07-10  
**Phase:** RC2.5 Step 3  
**Status:** ✅ **PASS** (with additions applied)

## File reviewed

`store-pilot/.gitignore`

## Verification matrix

| Pattern / path | Covered | Notes |
|----------------|---------|-------|
| `node_modules` | ✅ | Dependencies |
| `build/`, `/app/build`, `/public/build/` | ✅ | Generated bundles |
| `.react-router/` | ✅ | RR typegen cache |
| `.env`, `.env.*` | ✅ | Secrets |
| `database.sqlite`, `prisma/dev.sqlite` | ✅ | Local DB |
| `.shopify/*`, `.shopify.lock` | ✅ | Shopify CLI |
| `prisma/_e17_*`, `prisma/_e18_*` | ✅ | Legacy dev scripts |
| `.cache` | ✅ | Tooling cache |
| `.DS_Store` | ✅ | macOS |
| `Thumbs.db`, `Desktop.ini` | ✅ **Added** | Windows OS artifacts |
| `*.log`, `_typecheck.log` | ✅ **Added** | Diagnostic logs |
| `.rc25-*` | ✅ **Added** | Release-engineering temp files |
| `coverage/` | 🟡 **Not explicit** | No coverage output in tree; low risk |
| `.cursor/` | 🟡 **Not ignored** | `.cursor/rules/` ships intentionally |
| `node_modules/.cache/eslint` | ✅ | Under `node_modules` |
| Vercel `.vercel/` | 🟡 **Not explicit** | Typically local-only; not in pending paths |

## Changes applied

```diff
+ Thumbs.db
+ Desktop.ini
+ *.log
+ _typecheck.log
+ .rc25-*
```

**Rationale:** Prevent accidental commit of local diagnostics, Windows artifacts, and release-engineering scratch files.

## Items intentionally NOT ignored

| Path | Reason |
|------|--------|
| `.cursor/rules/*.mdc` | Team billing/architecture rules — ships with repo |
| `scripts/copy-vercel-prompts.mjs` | Required production build step |
| `scripts/worker.ts` | Railway worker entrypoint |

## Certification

**RC2.5 Step 3: PASS** — `.gitignore` updated; no generated or secret paths in pending release.
