# RC4 Database Deployment Certification

**Date:** 2026-07-10  
**Phase:** RC4 — Production Database  
**Status:** 🔴 **NOT EXECUTED** (production); 🟡 **DEV DB UP TO DATE**

## Local/dev evidence

```bash
cd store-pilot && npx prisma migrate status
```

```
36 migrations found in prisma/migrations
Database schema is up to date!
```

## Production deploy (not run)

```bash
# Against production DATABASE_URL
npx prisma migrate deploy
npx prisma migrate status
```

## Expected production outcome

| Metric | Expected after RC4 |
|--------|-------------------|
| Applied migrations | 36 |
| New migrations from RC1 | 14 |
| Failures | 0 |

## Current production signal

`/health/ready` on live deployment (pre-RC4):

```
migrations: ENOENT: no such file or directory, scandir '/var/task/prisma/migrations'
```

Indicates Vercel bundle lacks migration folder **and/or** production DB not migrated via deploy step.

## Rollback impact

Forward-only. Rollback = application rollback to `b1789a7`, not schema down-migration.

## Certification

**RC4 Database: FAIL / NOT EXECUTED** for production.
