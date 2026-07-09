# Repository Structure Recommendation

**Date:** 2026-07-09  
**Mode:** Read-only audit — no files moved, no Git changes  
**Git remote:** `https://github.com/businessleadintelligence/StorePilot.git`  
**Git root today:** `STOREPILOT/`  
**Deployable app today:** `STOREPILOT/store-pilot/`

---

## Executive summary

**Recommendation:** Promote `store-pilot/` to the Git repository root in a planned migration.

The current two-level layout (`STOREPILOT/` → `store-pilot/`) is a historical artifact from a docs-first bootstrap, not a deliberate monorepo. The deployable Shopify application, database, tests, and tooling already live almost entirely inside `store-pilot/`. The parent directory adds friction for Shopify CLI, Vercel, Cursor, TypeScript, and future CI/CD without delivering multi-project benefits today.

**If migration must be deferred** (e.g. during an active launch window), keep the parent root temporarily but treat it as technical debt. Do not add new parent-level code paths.

---

## Current layout

```
STOREPILOT/                         ← Git root (37 commits)
├── .git/
├── .gitignore                      ← Minimal; ignores recovery artifacts
├── README.md                       ← Stale ("Pre-Development v1")
├── RECOVERY_PROGRESS.md
├── RESTORATION_REPORT.md
├── docs/                           ← 47 tracked files (specs, infra audits)
├── scripts/                        ← 25 tracked files (transcript recovery)
├── store-pilot/                    ← 1,042 tracked files (~93% of repo)
│   ├── shopify.app.toml
│   ├── shopify.web.toml
│   ├── package.json
│   ├── package-lock.json
│   ├── pnpm-workspace.yaml
│   ├── prisma/schema.prisma
│   ├── vercel.json
│   ├── tsconfig.json
│   ├── app/
│   ├── docs/                       ← 5 app-specific docs
│   ├── scripts/                    ← 20 ops/deploy scripts
│   └── .cursor/
├── assets/, branding/, research/   ← Local only; not Git-tracked
├── recovery-from-transcript/       ← Gitignored
├── store-pilot.broken-backup/      ← Gitignored
└── test-output*.txt, typecheck*.txt ← Gitignored local artifacts
```

| Layer | Tracked files | Role |
|-------|--------------:|------|
| `store-pilot/` | 1,042 | Production Shopify app |
| `docs/` (parent) | 47 | Product specs + infrastructure audit reports |
| `scripts/` (parent) | 25 | One-off transcript/recovery utilities |
| Other parent root | ~4 | README, recovery markdown |

**Cursor workspace:** Opens `store-pilot/` directly (not the parent `STOREPILOT/` folder).

---

## Evaluation by concern

### Git history

| Finding | Detail |
|---------|--------|
| Total commits | 37 |
| Commits touching `store-pilot/` | 32 (86%) |
| First commit | `5ee01df` — architecture docs and Word specs only |
| App scaffold | `a8477a1` — Shopify app added under `store-pilot/` from day one |
| Latest major commit | `c116bbd` — v2 foundation; changes span both parent docs and app code |
| Nested corruption (resolved) | Recovery notes reference deleted `store-pilot/store-pilot/...` paths |

**Assessment:** History is young and mostly app-focused. Flattening is feasible with `git filter-repo` or a squash merge without losing meaningful archaeology. The nested path was never the long-term design — it was how the scaffold was first added.

---

### Shopify CLI

| Item | Current behavior |
|------|------------------|
| Config files | `store-pilot/shopify.app.toml`, `shopify.web.toml` |
| CLI project cache | `store-pilot/.shopify/project.json` |
| Dev command | `npm run dev` → `shopify app dev` (must run inside `store-pilot/`) |
| Deploy command | `shopify app deploy` (same directory) |
| CLI version | 4.4.0 |

Shopify CLI resolves the app from the directory containing `shopify.app.toml`. It supports `--path`, but every official template, doc example, and CI snippet assumes **the TOML is at the repository root**.

**Assessment:** Nested layout works only because developers (and Cursor) already `cd store-pilot`. This is unnecessary indirection. Flat root eliminates `--path`/`cd` requirements and matches Shopify conventions.

---

### Prisma

| Item | Location |
|------|----------|
| Schema | `store-pilot/prisma/schema.prisma` |
| Migrations | `store-pilot/prisma/migrations/` |
| Generate | `postinstall` + `npm run build` in `store-pilot/package.json` |
| Deploy migrate | `npm run setup` → `prisma migrate deploy` |

No Prisma configuration exists at the parent level. All database tooling is scoped to `store-pilot/`.

**Assessment:** Prisma expects to run from the app root. Nesting adds no benefit.

---

### Vercel

| Setting | Current value |
|---------|---------------|
| Root Directory | **`store-pilot`** (explicit dashboard setting) |
| Install command | `npm install` |
| Build command | `npm run build` |
| Production URL | `https://store-pilot-eta.vercel.app` |
| Config file | `store-pilot/vercel.json` |
| React Router preset | `store-pilot/react-router.config.ts` (`vercelPreset()`) |

Documented in parent `docs/VERCEL_SETUP_REPORT.md`:

> Set the Vercel **Root Directory** to `store-pilot`. The repository root contains docs and assets outside the deployable app.

**Assessment:** Vercel works today **because** of an extra Root Directory override. Promoting the app to repo root removes this setting, simplifies dashboard config, and aligns local paths with deployed paths. No application code change required.

---

### Cursor workspace

| Item | Current state |
|------|---------------|
| Workspace path | `store-pilot/` |
| Rules | `store-pilot/.cursor/rules/` |
| MCP config | `store-pilot/.cursor/mcp.json` |
| Parent `.cursor/` | Does not exist |

Developers and agents already treat `store-pilot/` as the effective project root. The Git root is a container they do not open directly.

**Assessment:** Cursor behavior already matches the recommended end state. Flattening Git to match Cursor removes a persistent source of path confusion (`../docs`, `cd store-pilot`, etc.).

---

### TypeScript

| Item | Location / note |
|------|---------------|
| `tsconfig.json` | `store-pilot/tsconfig.json` |
| `baseUrl` | `.` (relative to `store-pilot/`) |
| Stale exclude | `"store-pilot"` in `exclude` array — artifact of past nested corruption |
| Typecheck script | `react-router typegen && tsc --noEmit` |

No parent-level TypeScript project exists.

**Assessment:** TypeScript is fully app-scoped. The stale `exclude: ["store-pilot"]` entry is evidence the nested layout caused prior tooling confusion. Flat root allows removing that exclude.

---

### Package management

| Item | State |
|------|-------|
| Package name | `store-pilot` |
| Lockfile in use | `package-lock.json` (npm) |
| Vercel install | `npm install` |
| `pnpm-workspace.yaml` | Present; **`pnpm-lock.yaml` absent** |
| Workspaces | `extensions/*` — placeholder only (`.gitkeep`, no extensions) |
| Node engines | `>=20.19 <22 \|\| >=22.12` |

This is a **single-package app**, not a functioning monorepo. The pnpm workspace file is scaffold residue from the Shopify template.

**Assessment:** Package management already behaves as a single root package. Nesting adds no workspace value. After flattening, either remove `pnpm-workspace.yaml` or adopt pnpm consistently — but that is a separate cleanup decision.

---

### Deployment

| Path | Command / trigger |
|------|-------------------|
| Web app (Vercel) | Push to GitHub → Vercel builds from `store-pilot/` |
| Shopify config | Manual / CI: `cd store-pilot && shopify app deploy` |
| DB migrations | Manual: `cd store-pilot && npx prisma migrate deploy` |
| Env sync scripts | `store-pilot/scripts/sync-vercel-env.mjs`, `patch-env.mjs` |

Every production path already starts inside `store-pilot/`.

**Assessment:** Deployment scripts and runbooks repeatedly document `cd store-pilot`. Flattening removes this prefix from all operational docs and CI jobs.

---

### Scripts

| Location | Count | Purpose |
|----------|------:|---------|
| `store-pilot/scripts/` | 20 | Ongoing ops: Vercel env sync, Supabase provision, prod audits, worker backfill |
| `STOREPILOT/scripts/` | 25 | **Recovery-only:** transcript replay, dedupe, file restore from agent sessions |

Parent scripts were valuable during the June 2026 recovery sprint but are not part of the production toolchain. Ongoing automation lives in `store-pilot/scripts/`.

**Assessment:** Parent scripts should be archived or deleted during migration, not preserved at repo root.

---

### CI/CD

| Finding |
|---------|
| No `.github/workflows/` at parent or app level |
| No other CI config detected |
| Future pipelines will need `working-directory: store-pilot` for every job if layout stays nested |

**Assessment:** Absence of CI today makes this the ** lowest-risk window** to flatten before workflows are written. A flat root produces simpler, conventional GitHub Actions:

```yaml
# After flattening — no working-directory override needed
- run: npm ci
- run: npm run typecheck
- run: npm test
- run: npm run build
```

---

## Options compared

| Criterion | Keep `STOREPILOT/` root | Promote `store-pilot/` to root |
|-----------|:-----------------------:|:-------------------------------:|
| Shopify CLI conventions | ⚠️ Requires `cd` / `--path` | ✅ Native |
| Vercel config | ⚠️ Root Directory override | ✅ Default (`.`) |
| Prisma / TS / npm | ⚠️ All scoped to subfolder | ✅ Standard layout |
| Cursor alignment | ⚠️ Git root ≠ workspace | ✅ Git root = workspace |
| Future CI/CD | ⚠️ `working-directory` everywhere | ✅ Simple |
| Matches single-app reality | ❌ False monorepo | ✅ Honest structure |
| Migration cost | ✅ None | ⚠️ One-time effort |
| Multi-project future | ✅ Room at parent | ⚠️ Needs monorepo tooling if expanded |

---

## Recommendation

### Primary: Promote `store-pilot/` to repository root

**Why this is optimal long-term:**

1. **Single deployable artifact** — One Shopify embedded app on Vercel with Supabase. No second package, no shared library, no Shopify extensions in production.
2. **93% of tracked content is already inside `store-pilot/`** — The parent layer is mostly audit docs and recovery scripts, not ongoing product code.
3. **Tooling defaults assume flat root** — Shopify CLI, Vercel, Prisma, npm, Vitest, and GitHub Actions templates all expect `package.json` at repo root.
4. **Cursor already uses `store-pilot/` as workspace** — Flattening Git removes the mismatch between where developers work and where Git thinks the project lives.
5. **No CI/CD yet** — Migrating now avoids retrofitting `working-directory: store-pilot` into every workflow.
6. **Parent artifacts are transitional** — Recovery scripts, test output dumps, and broken backups should not anchor permanent structure.

### When to keep the parent root (temporary deferral)

Defer flattening only if:

- A production launch is hours/days away and you cannot absorb a structural PR.
- You have a **concrete plan within one quarter** to add a second deployable component (marketing site, admin CLI, shared SDK) that justifies a true monorepo.

If deferring, do **not** add new parent-level code, scripts, or configs. Treat `STOREPILOT/` as a thin wrapper with a documented sunset date.

---

## Migration plan (if proceeding)

**Estimated effort:** 2–4 hours for a clean move; 4–8 hours if preserving full Git history via filter-repo.

### Phase 0 — Preconditions

- [ ] Confirm no open deploy or App Store submission in flight
- [ ] Export Vercel project settings (Root Directory, env vars)
- [ ] Note current Shopify CLI linked app (`store-pilot/.shopify/project.json`)
- [ ] Ensure all work is committed and pushed

### Phase 1 — Consolidate content (no Git surgery yet)

1. **Merge documentation**
   - Move `STOREPILOT/docs/*` → `store-pilot/docs/platform/` (or merge into existing `store-pilot/docs/`)
   - Replace stale parent `README.md` with app README content
   - Keep product specs; update internal links that reference `store-pilot/` prefix

2. **Archive recovery tooling**
   - Move `STOREPILOT/scripts/` → `store-pilot/scripts/_archive/recovery/` **or** delete if recovery is complete
   - Confirm nothing in CI or package.json references parent scripts

3. **Handle local-only assets**
   - If `assets/`, `branding/`, `research/`, `screenshots/` should persist, move into `store-pilot/docs/assets/` or a dedicated `brand/` folder and track intentionally
   - Otherwise leave untracked or store outside the repo

### Phase 2 — Flatten Git tree

**Option A — History-preserving (recommended for audit trail):**

```bash
# Run from a clone; requires git-filter-repo
git filter-repo --to-subdirectory-filter store-pilot
```

Then re-add consolidated docs/scripts from Phase 1 at the new root.

**Option B — Squash move (simpler, loses path history):**

```bash
# Copy store-pilot contents to a fresh clone root
# Merge docs from Phase 1
# Single commit: "chore: promote store-pilot to repository root"
```

### Phase 3 — Tooling updates

| System | Action |
|--------|--------|
| **Vercel** | Set Root Directory to `.` (empty / repository root) |
| **Shopify CLI** | Re-link if needed: `shopify app config link` from new root |
| **TypeScript** | Remove stale `"store-pilot"` from `tsconfig.json` `exclude` |
| **Package manager** | Decide npm vs pnpm; remove unused `pnpm-workspace.yaml` if staying on npm |
| **Cursor** | Open repo at new root; move `.cursor/` remains at root |
| **Docs / runbooks** | Find-replace `cd store-pilot`, `store-pilot/`, Root Directory = `store-pilot` |
| **`.gitignore`** | Merge parent and app ignore rules at root |

### Phase 4 — Verification gate

Run from new repository root:

```bash
npm ci
npx prisma validate
npm run typecheck
npm test
npm run build
shopify app config validate
shopify app deploy --no-release --no-build   # optional; confirms TOML accepted
```

Deploy to Vercel preview; verify:

- `GET /health` → 200
- OAuth callback at `/auth/callback`
- Shopify webhook URIs unchanged (URLs are domain-based, not path-to-repo based)

### Phase 5 — Cleanup

- [ ] Delete empty `store-pilot/` directory if Option B left a shell
- [ ] Remove parent-only recovery markdown or move to `docs/history/`
- [ ] Update GitHub repo description if it references subdirectory layout
- [ ] Add CI workflow at root (`.github/workflows/ci.yml`) — first pipeline benefits from flat layout

---

## What not to do

| Anti-pattern | Reason |
|--------------|--------|
| Add a root `package.json` wrapper without workspaces | Creates fake monorepo complexity |
| Keep both roots long-term | Perpetual `cd store-pilot` and path confusion |
| Move app up but leave docs split across two `docs/` trees | Documentation drift |
| Rename repo folder on disk without updating Vercel/Shopify | Breaks deploy and OAuth |
| Flatten during active recovery | RECOVERY_PROGRESS.md shows recovery is largely complete — safe to plan now |

---

## Decision matrix

| Your situation | Action |
|----------------|--------|
| Preparing for App Store launch + CI setup | **Flatten now** before CI and runbooks harden |
| Launch within 48 hours | **Defer** 2 weeks; keep Root Directory = `store-pilot` |
| Adding marketing site or shared packages soon | **Keep parent root** but adopt proper monorepo tooling (pnpm/turbo, root package.json) |
| Solo dev, low churn | **Flatten at next quiet sprint** — lowest urgency, still recommended |

---

## Conclusion

The Git root should **not** remain at `STOREPILOT/` with the Shopify app nested indefinitely. That structure reflects bootstrap and recovery history, not current architecture.

**Optimal long-term structure:** `StorePilot` GitHub repo root = Shopify application root (`shopify.app.toml`, `package.json`, `prisma/`, `app/` at top level).

The parent `STOREPILOT/` wrapper adds configuration overhead (Vercel Root Directory, repeated `cd store-pilot`, Cursor/Git mismatch) without enabling a multi-project monorepo. Migrate when operational risk is acceptable — ideally before CI/CD is introduced.

---

## References (audited paths)

| Path | Relevance |
|------|-----------|
| `STOREPILOT/.git/` | Git root |
| `store-pilot/shopify.app.toml` | Shopify app config |
| `store-pilot/vercel.json` | Vercel build/cron/headers |
| `store-pilot/package.json` | Scripts, dependencies, engines |
| `store-pilot/prisma/schema.prisma` | Database schema |
| `store-pilot/tsconfig.json` | TypeScript (note stale exclude) |
| `docs/VERCEL_SETUP_REPORT.md` | Documents Root Directory = `store-pilot` |
| `RECOVERY_PROGRESS.md` | Evidence of nested-path corruption history |
