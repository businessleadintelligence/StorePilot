# Final Launch Certification — Phase C.2

**Certification date:** _Pending live verification_  
**Certifier:** Automated + manual E2E required

## Exit Criteria Scorecard

| Criterion | Code | Deployed | Evidence |
|-----------|------|----------|----------|
| Fresh install → 100% automatic | ✅ | ⏳ | E2E trace pending |
| Worker active (`activeWorkers >= 1`) | ✅ | ❌ | Railway deploy pending |
| UI reflects queue states | ✅ | ⏳ | After Vercel deploy |
| `/health` green | — | ✅ | 200 OK |
| `/health/ready` green | ✅ | ❌ | Prompt/scope fixes need deploy |
| `/health/worker` green | ✅ | ❌ | No worker deployed |
| `/health/monitor` green | — | ❌ | Depends on worker + ready |
| Canonical uninstall webhook | ✅ | ⏳ | After Vercel deploy |
| Prompt registry healthy | ✅ | ❌ | After Vercel deploy |
| Typecheck | ⚠️ | — | Pre-existing errors in intelligence-workspace; C.2 files clean |
| Full test suite | ✅ | — | 3033/3033 pass |

## Certification Status: **NOT CERTIFIED**

Reason: Production deployment and live E2E not yet executed.

## Required Actions to Certify

1. **Deploy Vercel** — includes prompt copy + scope embed + cron + webhook fix
2. **Deploy Railway worker** — verify heartbeat in `/health/worker`
3. **Fresh dev store install** — capture E2E trace to `PRODUCTION_VERIFICATION.md`
4. **Confirm stuck store repair** — or validate on new install only

## Risk Register

| Risk | Severity | Mitigation |
|------|----------|------------|
| No worker in prod | Critical | Railway deploy + cron fallback |
| Vercel Pro cron limit | Medium | Railway primary; cron fallback |
| False uninstall cancel | Medium | Canonical webhook idempotency |
| Typecheck debt (intelligence-workspace) | Low | Pre-existing; not C.2 scope |

## Sign-Off

- [ ] Engineering — code complete
- [ ] Infrastructure — worker deployed
- [ ] QA — E2E install verified
- [ ] Production — health endpoints green
