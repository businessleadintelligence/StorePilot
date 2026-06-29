# StorePilot — Real Store Test Results

**Sprint:** Real Store Validation v1.0  
**Dev store:** `storepilot-dev-1mfgthy7.myshopify.com`  
**Date:** 2026-06-29

**Legend:** ✅ PASS · ❌ FAIL · ⚠️ PARTIAL · 🚫 BLOCKED · ⏭️ NOT EXECUTED

---

## Phase 1 — Shopify Connection

| # | Scenario | Status | Evidence / Notes |
|---|----------|--------|------------------|
| 1.1 | App install | ⏭️ NOT EXECUTED | Embedded install flow not run — build blocked |
| 1.2 | OAuth | ⏭️ NOT EXECUTED | — |
| 1.3 | Scopes granted | ⚠️ PARTIAL | TOML scopes: `read_products,read_inventory,write_products,write_metaobjects,write_metaobject_definitions` — **missing `read_orders`** |
| 1.4 | Session creation | 🚫 BLOCKED | Prisma client invalid — cannot query `Session` table |
| 1.5 | Store record created | 🚫 BLOCKED | Same |
| 1.6 | Webhook registration | ⚠️ PARTIAL | Product/inventory/app webhooks in TOML; orders/billing/GDPR missing |
| 1.7 | Webhook verification (HMAC) | ⚠️ PARTIAL | Unit tests pass in `f44-gdpr-webhook-routes.test.ts` — **not live-delivered** |
| 1.8 | App reload | ⏭️ NOT EXECUTED | — |
| 1.9 | Embedded app loading | ⏭️ NOT EXECUTED | — |
| 1.10 | App uninstall | ⏭️ NOT EXECUTED | — |
| 1.11 | Reinstall | ⏭️ NOT EXECUTED | — |
| 1.12 | Session expiration | ⏭️ NOT EXECUTED | — |
| 1.13 | Permission updates (`scopes_update`) | ⏭️ NOT EXECUTED | Webhook route exists in codebase |

**Phase 1 result:** **FAIL** (0/13 full pass)

---

## Phase 2 — Shopify Data

| # | Scenario | Status | Notes |
|---|----------|--------|-------|
| 2.1 | Products sync | 🚫 BLOCKED | `app.dev.sync-products.tsx` exists — not run on live store |
| 2.2 | Collections | ⏭️ NOT EXECUTED | — |
| 2.3 | Inventory | ⏭️ NOT EXECUTED | Webhook route present |
| 2.4 | Orders | 🚫 BLOCKED | No `read_orders` scope |
| 2.5 | Images | ⏭️ NOT EXECUTED | — |
| 2.6 | Variants | ⏭️ NOT EXECUTED | — |
| 2.7 | Tags | ⏭️ NOT EXECUTED | — |
| 2.8 | SEO fields | ⏭️ NOT EXECUTED | — |
| 2.9 | Status | ⏭️ NOT EXECUTED | — |
| 2.10 | Product types | ⏭️ NOT EXECUTED | — |
| 2.11 | Vendor | ⏭️ NOT EXECUTED | — |
| 2.12 | Price | ⏭️ NOT EXECUTED | — |
| 2.13 | Compare-at price | ⏭️ NOT EXECUTED | — |
| 2.14 | Inventory quantities | ⏭️ NOT EXECUTED | — |
| 2.15 | Deleted products | ⏭️ NOT EXECUTED | Webhook route exists |
| 2.16 | Updated products | ⏭️ NOT EXECUTED | — |
| 2.17 | Large catalog sync | ⏭️ NOT EXECUTED | — |
| 2.18 | Incremental sync | ⏭️ NOT EXECUTED | — |
| 2.19 | Retry after failure | ⏭️ NOT EXECUTED | — |
| 2.20 | Sync recovery | ⏭️ NOT EXECUTED | — |
| 2.21 | Time required | ⏭️ NOT EXECUTED | — |
| 2.22 | Memory usage | ⏭️ NOT EXECUTED | — |
| 2.23 | Errors | ⏭️ NOT EXECUTED | — |

**Phase 2 result:** **FAIL** (0/23 executed on real data)

---

## Phase 3 — Connectors

| Connector / Scenario | Status |
|---------------------|--------|
| GA4 OAuth | ⏭️ NOT EXECUTED |
| GSC OAuth | ⏭️ NOT EXECUTED |
| PageSpeed | ⏭️ NOT EXECUTED |
| Microsoft Clarity | ⏭️ NOT EXECUTED |
| Token storage (encrypted) | 🚫 BLOCKED — `TOKEN_ENCRYPTION_KEY` not in local env |
| Refresh tokens | ⏭️ NOT EXECUTED |
| Reconnect / Disconnect | ⏭️ NOT EXECUTED |
| UnifiedStoreMetrics | 🚫 BLOCKED — connector platform routes missing |
| Data quality score | ⏭️ NOT EXECUTED |
| System Health connector panel | 🚫 BLOCKED — route missing |

**Phase 3 result:** **FAIL**

---

## Phase 4 — AI Agents

| Agent | Execution | Facts | Scores | Recommendations | Persistence |
|-------|-----------|-------|--------|-----------------|-------------|
| Product Intelligence | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 |
| Inventory Intelligence | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 |
| Bundle Discovery | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 |
| Store Audit | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 |
| SEO Intelligence | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 |
| Pricing Strategy | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 |
| Revenue Growth | 🚫 | 🚫 | 🚫 | 🚫 | 🚫 |
| Executive COO | ❌ FAIL | ❌ | ❌ | ❌ | ❌ — empty facts module |

**Phase 4 result:** **FAIL** — automated tests fail; no real-store AI runs

---

## Phase 5 — Collaboration

| Scenario | Status |
|----------|--------|
| Consensus | 🚫 BLOCKED |
| Dependencies | 🚫 BLOCKED |
| Conflicts | 🚫 BLOCKED |
| Executive actions | 🚫 BLOCKED |
| Executive Dashboard | 🚫 BLOCKED — no route |
| Critical path | 🚫 BLOCKED |

**Phase 5 result:** **FAIL**

---

## Phase 6 — Operations Center

All scenarios **🚫 BLOCKED** — no `app.operations.tsx` route.

**Phase 6 result:** **FAIL**

---

## Phase 7 — Automation

All scenarios **🚫 BLOCKED** — no `app.automation.tsx` route; executor not reachable.

**Phase 7 result:** **FAIL**

---

## Phase 8 — Shopify Mutations

All 8 production mutation templates **⏭️ NOT EXECUTED** on real store.

**Phase 8 result:** **FAIL**

---

## Phase 9 — Billing

All scenarios **🚫 BLOCKED** — no billing route; no billing webhook in TOML.

**Phase 9 result:** **FAIL**

---

## Phase 10 — System Health

All scenarios **🚫 BLOCKED** — no system health route.

**Phase 10 result:** **FAIL**

---

## Phase 11 — Background Jobs

| Scenario | Status | Notes |
|----------|--------|-------|
| Cron worker route exists | ✅ PASS | `cron.worker.tsx` present in codebase |
| Cron auth | ⚠️ PARTIAL | Unit tests in `f42-cron-worker.test.ts` — live cron not invoked |
| Queue / DLQ / Replay | 🚫 BLOCKED | `SyncJob` model not in current schema |
| Connector sync jobs | 🚫 BLOCKED | — |

**Phase 11 result:** **FAIL**

---

## Phase 12 — Security

See [REAL_STORE_SECURITY_REPORT.md](./REAL_STORE_SECURITY_REPORT.md).

**Phase 12 result:** **PARTIAL**

---

## Phase 13 — Performance

See [REAL_STORE_PERFORMANCE.md](./REAL_STORE_PERFORMANCE.md).

**Phase 13 result:** **NOT EXECUTED**

---

## Phase 14 — User Experience

### Routes reviewed (code audit)

| Route | Nav link | Loader data | Empty states | Notes |
|-------|----------|-------------|--------------|-------|
| `/app` | ✅ | ❌ null | ⚠️ N/A placeholders | BUG-005 |
| `/app/issues` | ✅ | Not executed live | — | — |
| `/app/timeline` | ✅ | — | — | — |
| `/app/recommendations` | ✅ | — | — | — |
| `/app/reports` | ✅ | — | — | — |
| `/app/settings` | ✅ | — | — | — |
| Command Center | ❌ missing | — | — | BUG-004 |
| Executive | ❌ missing | — | — | — |
| Operations | ❌ missing | — | — | — |
| Automation | ❌ missing | — | — | — |
| Billing | ❌ missing | — | — | — |
| System Health | ❌ missing | — | — | — |
| Onboarding | ❌ missing | — | — | — |

### UX checklist

| Item | Status |
|------|--------|
| Navigation consistency | ⚠️ PARTIAL — reduced nav vs spec |
| Loading states | ⏭️ NOT EXECUTED live |
| Error messages | ⏭️ NOT EXECUTED |
| Mobile / dark mode | ⏭️ NOT EXECUTED |
| Spelling / grammar | ⚠️ PARTIAL — production landing has template placeholders (BUG-007) |

**Phase 14 result:** **PARTIAL** (code review only)

---

## Aggregate Results

| Phase | Pass | Fail | Blocked | Not executed |
|-------|------|------|---------|--------------|
| 1 | 0 | 1 | 2 | 10 |
| 2 | 0 | 1 | 2 | 20 |
| 3 | 0 | 1 | 3 | all connectors |
| 4–10 | 0 | 7 | — | — |
| 11 | 1 | 1 | 2 | — |
| 12 | — | — | partial | — |
| 13 | — | — | not executed | — |
| 14 | — | — | partial | — |

**Overall:** **NOT READY** — real-store E2E validation incomplete.
