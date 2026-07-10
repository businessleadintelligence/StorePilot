# RC4A Step 5 — Docker Verification

**Date:** 2026-07-10  
**Status:** 🔴 **FAIL — BUILD NOT EXECUTED**  
**Publish executed:** ⛔ **NO**

## Dockerfile.worker review

```dockerfile
FROM node:20-alpine
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm ci && npm cache clean --force
COPY . .
RUN npm run build
CMD ["npm", "run", "worker"]
```

| Check | Static review | Local build |
|-------|---------------|-------------|
| Base image | `node:20-alpine` ✅ | — |
| OpenSSL (Prisma) | ✅ | — |
| Dependencies | `npm ci` ✅ | — |
| Full context copy | `COPY . .` includes prompts + migrations ✅ | — |
| Build step | Runs `copy-vercel-prompts.mjs` via `npm run build` ✅ | — |
| Worker CMD | `npm run worker` → `tsx scripts/worker.ts` ✅ | — |
| **Docker build completes** | — | ❌ **Not run** |
| **Worker starts** | — | ❌ **Not run** |

## Build attempt

```bash
docker --version   # 29.6.1
docker build -f Dockerfile.worker -t storepilot-worker-rc4a-dryrun .
```

**Result:** ❌ Docker daemon not running

```
failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine
```

## Risk notes

| Risk | Impact |
|------|--------|
| Node 20 (Docker) vs Node 24 (Vercel) | Medium — test worker on Railway before RC4 |
| `COPY . .` includes dev artifacts if `.dockerignore` missing | Medium — verify `.dockerignore` exists |
| Full `npm run build` in worker image | Low — required for prompts |

## Required actions before RC4

1. Start Docker Desktop OR rely on Railway remote build
2. Run `docker build -f Dockerfile.worker .` and confirm exit 0
3. Run container locally with env file; confirm worker heartbeat registers

## Verdict

**FAIL** — No objective Docker build evidence in RC4A.
