# Shopify App Store Submission Checklist — Phase C

**Date:** 2026-07-10  
**App URL:** https://store-pilot-eta.vercel.app  
**Status:** ❌ **NOT READY FOR SUBMISSION**

---

## Blocking Items (Must Fix)

- [ ] **Background worker operational** — `activeWorkers >= 1` or cron every 2 min
- [ ] **Fresh install completes onboarding to 100%** without manual intervention
- [ ] **Products/orders sync** verified on clean dev store
- [ ] **app/uninstalled webhook** — route uses idempotent handler; Partner Dashboard shows success
- [ ] **/health/ready returns 200** — prompts bundled, migrations check passes
- [ ] **Webhook delivery** — all registered topics succeed in Partner Dashboard

---

## App Configuration

- [x] Application URL matches production
- [x] Redirect URL `/auth/callback` configured
- [x] Embedded app enabled
- [x] API version 2025-10 for webhooks
- [x] Minimum scopes (no customer PII scopes)
- [ ] Scope drift false positive resolved for monitoring
- [x] Compliance webhooks registered (GDPR)

---

## Billing (Shopify Managed Pricing)

- [ ] Test subscription charge accepted on dev store
- [ ] `app_subscriptions/update` webhook verified
- [x] Plan registry SSOT (starter/growth/scale)
- [ ] BILLING_TEST_MODE confirmed off in production

---

## Privacy & Data Handling

- [x] Privacy policy URL (verify in Partner listing — not in repo audit)
- [x] No prohibited customer scopes
- [ ] Customer data export TTL verified
- [ ] shop/redact + customers/redact live-tested
- [ ] Uninstall data deletion verified end-to-end

---

## Performance & Reliability

- [ ] Dashboard loads < 3s with warm function (not benchmarked)
- [ ] Worker processes jobs within 5 min of install
- [ ] Error rate acceptable (not measured)
- [ ] Database pool configured for serverless

---

## UX & Functionality

- [x] Dashboard routes exist for all advertised workspaces
- [ ] Intelligence data populates after install
- [ ] Executive COO functional (requires worker + AI prompts)
- [x] Empty states for pre-sync dashboard
- [ ] Trial flow clear to merchant

---

## Testing Evidence Required for Review

| Artifact | Status |
|----------|--------|
| Screen recording: install → dashboard ready | ❌ |
| Screen recording: uninstall → data removed | ❌ |
| Webhook delivery export | ❌ |
| Billing test receipt | ❌ |
| 3033 automated tests passing | ✅ |

---

## Submission Notes for Reviewer

1. StorePilot is an **operational intelligence** app — requires background sync before intelligence appears.
2. Document expected time-to-value: sync (~minutes) + intelligence pipeline (~hours) after worker fix.
3. Executive COO requires `AI_PLATFORM_ENABLED=true` and prompt bundle fix.

---

## Post-Fix Re-Validation Order

1. Deploy worker → confirm `/health/worker`
2. Fresh install on new dev store
3. Wait for 100% onboarding + intelligence cards populated
4. Trigger uninstall → verify Partner webhook success
5. Re-run Phase C scorecard
