# Final Production Incident Report — P0 Fresh Install Crash

**Incident ID:** P0-INSTALL-20260710  
**Report date:** 2026-07-10  
**Overall status:** 🔴 **OPEN** — root cause confirmed, fix coded, **not production-certified**

---

## 1. Incident summary

Brand-new Shopify merchants completing OAuth saw **Unexpected Server Error** on first embedded dashboard load. Production health endpoints remained green.

---

## 2. Root cause (confirmed)

**SSR abort due to dashboard loader DB fan-out on document request.**

Vercel stack trace (2026-07-10 23:07:59 UTC, `GET /app`, shop `varsha-cf8clnuz.myshopify.com`):

```
Error: The render was aborted by the server without a reason.
    at Timeout.abort [as _onTimeout] (.../react-dom-server.node.production.min.js:102:385)
```

Triggered by `app/routes/app._index.tsx` returning seven unresolved intelligence Promises during SSR, combined with `connection_limit=1` Prisma pool and 13s+ Session query latency.

Full analysis: [ROOT_CAUSE_ANALYSIS.md](./ROOT_CAUSE_ANALYSIS.md)  
Full stack traces: [STACK_TRACE_ANALYSIS.md](./STACK_TRACE_ANALYSIS.md)

---

## 3. Fix applied (local)

Skip intelligence DB queries on document SSR; client revalidates via `.data` request after hydration.

Details: [FIX_IMPLEMENTATION.md](./FIX_IMPLEMENTATION.md)

---

## 4. Test evidence

| Layer | Result |
|-------|--------|
| New unit tests (SSR guard) | ✅ 4/4 pass |
| Full suite | Not re-run in this incident pass |
| Production MV-1 fresh install | ⏳ **Not executed** |

---

## 5. Certification gate

| Criterion | Status |
|-----------|--------|
| New dev store installs end-to-end | ❌ Not verified |
| Dashboard loads without Unexpected Server Error | ❌ Not verified post-fix |
| No accounts.shopify.com iframe error on happy path | ❌ Not verified |
| Logs + screenshots in report | ⚠️ Pre-fix logs captured; post-fix pending |

---

## 6. Pre-fix production evidence (attached)

**Incident request log excerpt** — see [STACK_TRACE_ANALYSIS.md](./STACK_TRACE_ANALYSIS.md)

**Shopify error UX chain:**
- `app/routes/app.tsx` L49–50 → `boundary.error()` → **Unexpected Server Error**
- `app/root.tsx` L61 → **Something went wrong**

**Secondary failure:** `GET /app/coo` → Prisma `P2024` pool timeout (same pool contention class)

---

## 7. Recommended next steps

1. **Deploy** fix to Vercel production
2. **Execute** [MV1_REVALIDATION.md](./MV1_REVALIDATION.md) on a **new** development store
3. **Capture** post-fix Vercel logs showing clean `GET /app` (no SSR abort)
4. **Update** this report to 🟢 RESOLVED only after MV-1 pass
5. **Optional follow-up:** COO dashboard (`/app/coo`) parallel health queries under `connection_limit=1` (separate ticket)

---

## 8. Sign-off

| Role | Name | Date | Status |
|------|------|------|--------|
| Investigation | Cursor Agent | 2026-07-10 | Root cause confirmed |
| Fix implementation | Cursor Agent | 2026-07-10 | Local fix complete |
| Production certification | _Pending_ | | **NOT APPROVED** |

---

**This incident is NOT closed.** Do not mark "fixed" until MV-1 revalidation passes on a completely new Shopify development store.
