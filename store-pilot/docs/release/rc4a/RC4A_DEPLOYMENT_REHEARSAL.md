# RC4A Step 12 — Deployment Rehearsal

**Date:** 2026-07-10  
**Method:** Mental simulation + evidence from Steps 1–11  
**Deploy executed:** ⛔ **NO**

## Rehearsal flow

```
Git Push → Vercel Build → Railway Build → migrate deploy → Worker Start → Health → Install → Sync → Dashboard
```

---

### Step 1: Git Push

| Question | Answer |
|----------|--------|
| What could fail? | Auth, branch protection, large diff rejection |
| Detection | `git push` exit code |
| Fix | Resolve protection rules; push tag separately |
| Probability | Low | Impact | High | Recovery | 15 min |

**Current state:** 2 commits + tag unpushed ✅ identified

---

### Step 2: Vercel Build

| Question | Answer |
|----------|--------|
| What could fail? | OOM, type error, missing env at build time, 9.5MB λ limit |
| Detection | Vercel build logs, deployment Error status |
| Fix | Roll back promote; fix build |
| Probability | Low (local build pass) | Impact | High | Recovery | 10–30 min |

**Evidence:** Local `npm run build` ✅; prior deploy 10h ago showed one **Error** deployment

---

### Step 3: Railway Build

| Question | Answer |
|----------|--------|
| What could fail? | Docker build fail, wrong Dockerfile path, npm ci fail |
| Detection | Railway build logs |
| Fix | Fix Dockerfile; verify `railway.toml` |
| Probability | **Medium** (Docker not tested locally) | Impact | High | Recovery | 30–60 min |

**Blocker:** Docker daemon down in RC4A; project not linked

---

### Step 4: Prisma migrate deploy

| Question | Answer |
|----------|--------|
| What could fail? | Lock timeout, migration conflict, billing_unification data update |
| Detection | `migrate deploy` exit code; `/health/ready` migrations check |
| Fix | Forward fix migration; PITR last resort |
| Probability | Low–Medium | Impact | **Critical** | Recovery | 1 hr+ |

**Note:** Connected DB already at 36/36 — production may match; still must run deploy step explicitly

---

### Step 5: Worker startup

| Question | Answer |
|----------|--------|
| What could fail? | Missing env, DB connection, crash loop |
| Detection | `/health/worker`, Railway logs, `no_active_workers` alert |
| Fix | Env parity; restart service |
| Probability | **High** (worker never deployed) | Impact | **Critical** | Recovery | 30 min |

**Current prod:** `activeWorkers: 0`

---

### Step 6: Health endpoints

| Question | Answer |
|----------|--------|
| What could fail? | Prompts, migrations check, scope drift, worker |
| Detection | RC5 probe script |
| Fix | RC1 code deploy + env vars |
| Probability | Medium post-RC1 deploy | Impact | High | Recovery | 15–60 min |

**RC1 fixes address:** prompts, scope drift, migration FS check

---

### Step 7: Fresh Shopify install

| Question | Answer |
|----------|--------|
| What could fail? | OAuth, webhooks, bootstrap queue, worker absent |
| Detection | Onboarding stuck < 100%; RC6 doc |
| Fix | Worker online; queue repair |
| Probability | Medium | Impact | **Critical** | Recovery | 2–4 hr |

---

### Step 8–9: Sync + Dashboard

| Question | Answer |
|----------|--------|
| What could fail? | Worker not processing; AI_PLATFORM off |
| Detection | Dashboard empty; job queue depth |
| Fix | Enable AI; verify worker |
| Probability | Medium | Impact | High | Recovery | 1–2 hr |

---

## Top rehearsal risks (ranked)

1. **Railway worker not configured** — P: High, I: Critical
2. **`AI_PLATFORM_ENABLED` missing** — P: Certain, I: High
3. **Git not pushed before deploy** — P: Certain if skipped, I: Critical
4. **Docker build unverified** — P: Medium, I: High
5. **First production deploy of 657-file delta** — P: Medium, I: High

## Verdict

Rehearsal complete. **Multiple high-probability failures identified and mitigations documented.** No deploy performed.
