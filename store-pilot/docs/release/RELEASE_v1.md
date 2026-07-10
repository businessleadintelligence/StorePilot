# Release v1.0 — StorePilot Production Launch Candidate

**Release name:** StorePilot v1.0 Intelligence Platform  
**Target date:** TBD (blocked on certification)  
**Release engineer:** Production Certification Program  
**Production URL:** https://store-pilot-eta.vercel.app

## Scope

Feature-complete Shopify merchant intelligence SaaS. **No new features** in this release — deployment and certification only.

### Included (local, not yet deployed)

- Epic 1 / Epic 2 architecture hardening
- Phase B privacy & Shopify compliance
- Phase C.2 production remediation (queue, worker, health, webhook, onboarding truth)
- Full intelligence pipeline (Knowledge, Graph, Learning, Executive, Root Cause, Prediction, Experiments, Merchant Intelligence)
- Billing unification
- Worker infrastructure (Railway + cron fallback)

## Release artifacts

| Artifact | Location |
|----------|----------|
| Certification index | `docs/certification/00_MASTER_CERTIFICATION_INDEX.md` |
| Go/No-Go | `docs/certification/17_PRODUCTION_GO_NO_GO.md` |
| Deployment checklist | `docs/remediation/DEPLOYMENT_VALIDATION_CHECKLIST.md` |

## Quality gates

| Gate | Status (2026-07-10) |
|------|---------------------|
| Tests | 🟢 3033/3033 |
| Build | 🟢 Success |
| Typecheck | 🔴 120 errors |
| Lint | 🔴 92 problems |
| Git clean | 🔴 278 dirty paths |
| Production deploy | 🔴 Pre-C.2 commit |
| E2E fresh install | 🔴 Not verified |

## Breaking changes

None intended.

## Migration notes

36 Prisma migrations. Run `npx prisma migrate deploy` before app deploy.

## Known issues at release cut

See `docs/production/FINAL_LAUNCH_BLOCKERS.md` — fixes exist locally, not deployed.

## Sign-off required

- [ ] Engineering
- [ ] Infrastructure  
- [ ] Privacy
- [ ] Shopify submission owner
