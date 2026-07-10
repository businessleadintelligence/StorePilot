# RC2.5 Cleanup Report

**Date:** 2026-07-10  
**Phase:** RC2.5 Step 2 — Accidental file scan  
**Status:** ✅ **PASS**

## Scan scope

Searched pending paths and full `store-pilot/` tree for:

`tmp`, `backup`, `old`, `copy`, `debug`, `notes`, `scratch`, `draft`, duplicate prompts, stale logs, build artifacts, coverage, cache files.

## Actions taken

| File | Classification | Action | Evidence |
|------|----------------|--------|----------|
| `store-pilot/_typecheck.log` | Temporary (~864 KB) | **Removed** | `git status` shows `D store-pilot/_typecheck.log` |
| `store-pilot/.rc25-status.txt` | Temporary (agent scratch) | **Removed** | File deleted before freeze |
| `store-pilot/.rc25-inventory.csv` | Temporary (inventory generator) | **Removed** | Not committed |

## Pending paths — accidental files found

| File | Verdict |
|------|---------|
| `_typecheck.log` | **NO SHIP** — deleted |
| All other 279 paths | **Intentional** — see `RC25_FILE_INVENTORY.md` |

## Already committed legacy scripts (NOT in pending 281 — REVIEW only)

These exist at `HEAD` but are **not part of this release delta**. Not deleted per rule *"Nothing production-related may be deleted"* and to avoid scope creep.

| File | Issue | Recommendation |
|------|-------|----------------|
| `store-pilot/_patch-store.mjs` | One-off schema patch script with hardcoded path | **REVIEW** — post-launch removal |
| `store-pilot/scripts/_e32b_run.mjs` | Dev-only order sync against named shop | **REVIEW** — post-launch removal |
| `prisma/_e17_query.mjs` | Already in `.gitignore` | Ignored ✅ |
| `prisma/_e17_readiness.sql` | Already in `.gitignore` | Ignored ✅ |
| `prisma/_e18_verify.mjs` | Already in `.gitignore` | Ignored ✅ |

## Duplicate / orphan checks

| Check | Result |
|-------|--------|
| Duplicate prompt files | ✅ None — 14 unique `.md` files |
| Duplicate migrations | ✅ None — unique timestamps |
| Orphan routes | ✅ None found in pending set |
| Build artifacts in git | ✅ None — `build/` gitignored |
| Coverage artifacts | ✅ None |
| Stale logs | ✅ Removed |

## Commands executed

```bash
# Glob scans for *.log, *.bak, *copy*, *scratch*, *draft*
git status --porcelain
Remove-Item store-pilot/_typecheck.log, .rc25-status.txt, .rc25-inventory.csv
```

## Certification

**RC2.5 Step 2: PASS** — No unnecessary files remain in the pending release package.
