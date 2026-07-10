# 09 — UI Certification

**Date:** 2026-07-10  
**Status:** 🔴 **NOT VERIFIED**

## Automated evidence

| Check | Status |
|-------|--------|
| Route tests (f45–f57 dashboard) | 🟢 Pass in 3033 suite |
| Intelligence workspace test | 🟢 `intelligence-workspace.test.ts` |
| Onboarding UI tests | 🟢 f45 updated for C.2 pipeline states |
| Typecheck on workspace views | 🔴 FAIL — blocks strict CI |

## Manual UI matrix — NOT VERIFIED

Requires deployed app + merchant session in Shopify admin:

- [ ] Every app route loads without 500
- [ ] Workspaces (Executive, Root Cause, Prediction, Experiments, Merchant Intelligence, Knowledge Graph, Business Memory, COO)
- [ ] Navigation / breadcrumbs / command palette
- [ ] Onboarding card shows Queued→Running truth (post C.2 deploy)
- [ ] No dead links / empty error pages
- [ ] Sync status badges (Queued, Claimed, Running, Completed)

## Known pre-deploy UI bug (C.1)

Dashboard showed "Syncing products" while job=cancelled — **fix in local C.2, not deployed**.

## Required human action

Manual QA pass in Shopify embedded app after deploy. Record screenshots in E2E doc.

## Certification result

**NOT CERTIFIED**
