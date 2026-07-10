# Railway Deployment — DEPRECATED

**Date:** 2026-07-10  
**Status:** ⛔ **NOT USED** — StorePilot runs entirely on Vercel

---

This document is retained for historical reference only. StorePilot production architecture is:

**GitHub → Vercel → Vercel Cron → Supabase → Shopify**

See:

- [WORKER_DEPLOYMENT.md](./WORKER_DEPLOYMENT.md) — Vercel Cron worker verification
- [DEPLOYMENT_PLAN.md](../release/DEPLOYMENT_PLAN.md) — production deployment sequence
- [WORKER_ARCHITECTURE.md](../WORKER_ARCHITECTURE.md) — current architecture

Do not deploy `Dockerfile.worker` or `railway.toml` for StorePilot production.
