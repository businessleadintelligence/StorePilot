# Final Launch Blockers — Phase C.1

**Date:** 2026-07-10  
**Launch ready:** ❌ **NO**

---

## Blocker Priority List

### B1 — No Job Executor (Critical)

| | |
|---|---|
| **Evidence** | activeWorkers=0; bootstrap attempts=0; 0 products |
| **Action** | Deploy Railway worker OR Vercel Pro + */2 cron |
| **Verify** | Job claimed within 5 min of install |

### B2 — Bootstrap Job Cancelled + Onboarding Stuck (Critical)

| | |
|---|---|
| **Evidence** | DB: job cancelled 00:06 UTC; onboarding still 33% running |
| **Action** | Reconcile onboarding; re-enqueue bootstrap for affected store(s) |
| **Verify** | progressPercent reaches 100 |

### B3 — Dashboard Shows Running When Job Not Active (High)

| | |
|---|---|
| **Evidence** | productSyncStatus=running + job=cancelled |
| **Action** | Fix phase status semantics (queued vs running) |
| **Verify** | UI matches queue state |

### B4 — Runtime Prompt Bundle Failure (High)

| | |
|---|---|
| **Evidence** | /health/ready — 13 missing prompts; local ok |
| **Action** | Fix serverless prompt path |
| **Verify** | foundation_prompt_registry ok |

### B5 — app/uninstalled Dual Handler (High)

| | |
|---|---|
| **Evidence** | Route bypasses handleAppUninstalledWebhook |
| **Action** | Wire canonical handler |
| **Verify** | Partner Dashboard deliveries |

### B6 — Cron Execution Unproven (High)

| | |
|---|---|
| **Evidence** | Job never ran; Vercel logs not accessed |
| **Action** | Pull Vercel cron logs Jul 9–10 |
| **Verify** | Cron invoked with 200 + job processed |

### B7 — Fresh Install E2E Not Completed (High)

| | |
|---|---|
| **Evidence** | Only existing dev store traced |
| **Action** | New store install after B1 fixed |
| **Verify** | Full pipeline to 100% |

### B8 — External Monitoring Missing (Medium)

| | |
|---|---|
| **Evidence** | No alerting config |
| **Action** | Uptime on /health/worker |
| **Verify** | Test alert fires |

### B9 — AI_PLATFORM_ENABLED Missing (Medium)

| | |
|---|---|
| **Evidence** | vercel env ls |
| **Action** | Set when AI COO required |
| **Verify** | COO AI output |

### B10 — Readiness False Positives (Medium)

| | |
|---|---|
| **Evidence** | scope drift + migrations on Vercel |
| **Action** | Serverless-aware readiness checks |
| **Verify** | /health/ready 200 |

---

## Final Table

| Item | Status | Evidence | Action Required |
|------|--------|----------|-----------------|
| Worker | ❌ | Runtime + DB | **Yes** |
| Cron | ⚠️ | vercel crons ls; execution not verified | **Yes** |
| Prompt Registry | ❌ | /health/ready | **Yes** |
| Webhooks | ⚠️ | Code audit; Partner Dashboard not verified | **Yes** |
| Install Pipeline | ❌ | DB trace | **Yes** |
| Queue | ❌ | DB: cancelled job, 0 completed | **Yes** |
| Dashboard | ❌ | DB vs UI mismatch | **Yes** |
| AI Runtime | ⚠️ | Provider ok; prompts fail | **Yes** |
| Environment | ⚠️ | vercel env ls | **Yes** |
| Launch Ready | ❌ | Composite | **Yes** |

---

## Recommended Remediation Sprint Order

1. Deploy worker + confirm cron OR continuous heartbeat  
2. Repair stuck store + re-enqueue bootstrap  
3. Fix prompt bundling for Vercel  
4. Wire uninstall webhook to service handler  
5. Fix onboarding queued/running semantics  
6. Fresh install E2E validation  
7. External monitoring + Partner Dashboard webhook audit  

**Estimated effort:** 2–3 engineering days (fixes only — no new features)
