# StorePilot — Dependency Audit

**Date:** 2026-07-09  
**Source:** `store-pilot/package.json`, `npm audit`

---

## Production dependencies (17)

| Package | Version | Purpose |
|---------|---------|---------|
| `@prisma/client` | ^6.16.3 | Database ORM |
| `@react-router/dev` | ^7.12.0 | Build tooling |
| `@react-router/fs-routes` | ^7.12.0 | File-based routing |
| `@react-router/node` | ^7.12.0 | Node adapter |
| `@react-router/serve` | ^7.12.0 | Production server |
| `@shopify/app-bridge-react` | ^4.2.4 | Embedded app UI |
| `@shopify/shopify-app-react-router` | ^1.1.0 | Shopify app framework |
| `@shopify/shopify-app-session-storage-prisma` | ^9.0.0 | Session storage |
| `@vercel/react-router` | ^1.3.1 | Vercel deployment preset |
| `isbot` | ^5.1.31 | Bot detection |
| `openai` | ^6.45.0 | AI provider (explicit dep for server bundle) |
| `prisma` | ^6.16.3 | Schema tooling |
| `react` | ^18.3.1 | UI framework |
| `react-dom` | ^18.3.1 | UI rendering |
| `react-router` | ^7.12.0 | Routing |
| `vite-tsconfig-paths` | ^5.1.4 | Path aliases |
| `zod` | ^4.4.3 | Schema validation (explicit dep for server bundle) |

---

## Dev dependencies (19)

Key: `typescript`, `vitest`, `eslint` (+ plugins), `vite`, `@vitest/coverage-v8`, Shopify codegen preset.

**Notable absence:** `@testing-library/react` — not installed; f56 test converted to `renderToString`.

---

## Security advisories

```bash
npm audit --omit=dev
# 3 moderate severity vulnerabilities (2026-07-09)
```

| Severity | Count |
|----------|------:|
| Critical | 0 |
| High | 0 |
| Moderate | 3 |

Run `npm audit` for full details. No critical/high advisories in production deps at time of audit.

---

## Duplicate / deprecated analysis

| Check | Result |
|-------|--------|
| Duplicate HTTP clients | None — Shopify SDK + native fetch |
| Duplicate validation libs | Zod only |
| Duplicate ORMs | Prisma only |
| Deprecated packages | None flagged by npm |
| Unused production deps | All referenced in build/runtime |
| Version conflicts | `overrides: { "p-map": "^4.0.0" }` for Shopify CLI compat |

---

## Recommendations

| Priority | Action |
|----------|--------|
| Low | Run `npm audit fix` for 3 moderate vulnerabilities |
| Low | Add `@testing-library/react` only if client-side interaction tests are needed |
| Info | `openai` and `zod` added as explicit deps for Vercel server bundle resolution |
| N/A | Resend, Railway — not in dependency tree (not implemented) |

---

## Node engine

```json
"engines": { "node": ">=20.19 <22 || >=22.12" }
```

Vercel: Node 22.x recommended per `VERCEL_SETUP_REPORT.md`.
