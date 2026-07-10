# RC4A Step 11 — Dependency Audit

**Date:** 2026-07-10  
**Status:** 🟡 **PASS WITH CONDITIONS**

## Runtime versions

| Tool | Version | Required |
|------|---------|----------|
| Node (local) | v24.16.0 | `>=20.19 <22 \|\| >=22.12` ✅ |
| Node (Vercel) | 24.x | ✅ |
| Node (Dockerfile.worker) | 20-alpine | 🟡 Split from Vercel |
| npm | 11.13.0 | — |
| TypeScript | 5.9.3 | — |

## Key packages

| Package | Version |
|---------|---------|
| `@prisma/client` | ^6.16.3 (resolved 6.19.3) |
| `react-router` | ^7.12.0 |
| `@react-router/dev` | ^7.12.0 |
| `vite` | ^6.3.6 |
| `@shopify/shopify-app-react-router` | ^1.1.0 |
| `openai` | ^6.45.0 |
| `@vercel/react-router` | ^1.3.1 |
| `vitest` | ^4.1.9 |

## Build compatibility

| Check | Result |
|-------|--------|
| `npm run typecheck` | ✅ exit 0 |
| `npm run lint` | ✅ exit 0 |
| `npm run build` | ✅ exit 0 |
| Lockfile | `package-lock.json` present |

## npm audit (`--omit=dev`)

```
3 moderate severity vulnerabilities
ajv ReDoS via @vercel/react-router → @vercel/static-config
No fix available
```

## Peer / deprecation warnings

| Item | Severity |
|------|----------|
| Prisma `package.json#prisma` deprecated | Low |
| Vite dynamic import warnings | Low |
| ajv moderate CVE chain | Medium (transitive, no fix) |

## Verdict

**PASS WITH CONDITIONS** — Build-compatible; monitor ajv advisory; align Node 20 vs 24 in worker smoke test.
