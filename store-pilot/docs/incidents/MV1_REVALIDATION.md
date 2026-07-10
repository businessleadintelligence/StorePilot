# MV-1 Revalidation — P0 Install Crash

**Status:** PENDING — requires manual fresh Shopify development store  
**Blocked on:** Deploy fix to production, then execute checklist below

---

## Pre-requisites

- [ ] Fix from [FIX_IMPLEMENTATION.md](./FIX_IMPLEMENTATION.md) deployed to `store-pilot-eta.vercel.app`
- [ ] `prisma migrate deploy` confirmed (already applied for `fc584ba`)
- [ ] Vercel `DATABASE_URL` pool params unchanged unless intentionally updated

---

## Test store

| Field | Value |
|-------|-------|
| Store name | TBD — new dev store |
| myshopify.com domain | TBD |
| Install date/time (IST) | TBD |
| Tester | TBD |

Do not reuse `varsha-cf8clnuz.myshopify.com` (incident store) for certification.

---

## Timestamp checklist

Record ISO-8601 timestamps (IST) for each event:

| Event | Timestamp | Evidence |
|-------|-----------|----------|
| OAuth Start | | Partner Dashboard / browser network |
| OAuth Complete | | Redirect to /app or embedded admin |
| Dashboard First Paint | | Screenshot — no error boundary |
| Bootstrap Enqueued | | Vercel log `[after-auth] post_auth_bootstrap_enqueued` |
| Bootstrap Started | | Vercel log `[post-auth-bootstrap]` |
| Products Synced | | Dashboard sync card / onboarding UI |
| Orders Synced | | Onboarding phase status |
| Knowledge Graph Built | | Worker logs or KG workspace |
| Root Cause Generated | | Dashboard or workspace |
| Prediction Generated | | Dashboard or workspace |
| Experiments Generated | | Dashboard or workspace |
| Merchant Intelligence Generated | | Dashboard section |
| Dashboard Complete | | All sections loaded or empty states |
| 100% Onboarding | | Onboarding progress 100% |

---

## Pass criteria

- [ ] No Unexpected Server Error on first /app open
- [ ] No Something went wrong page
- [ ] No accounts.shopify.com refused to connect during happy-path install
- [ ] Vercel logs for GET /app show no SSR abort error
- [ ] Screenshot of successful dashboard attached

---

## Vercel log capture (post-install)

```powershell
npx vercel logs store-pilot-eta.vercel.app --query "GET /app" --since 30m --expand
npx vercel logs store-pilot-eta.vercel.app --query "after-auth OR post-auth-bootstrap" --since 30m --expand
```

Paste relevant log excerpt in [FINAL_PRODUCTION_INCIDENT_REPORT.md](./FINAL_PRODUCTION_INCIDENT_REPORT.md).

---

## Result

**NOT CERTIFIED** as of 2026-07-10 23:35 IST.
