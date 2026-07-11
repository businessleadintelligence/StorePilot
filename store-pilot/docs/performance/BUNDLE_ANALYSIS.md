# Bundle Analysis — P1 Performance Sprint

---

## Build output (post-optimization)

| Artifact | Approx size | Notes |
|----------|-------------|-------|
| Server `server-build-*.js` | ~2,527 KB | Monolithic SSR bundle |
| Client CSS | Shared dashboard styles | Single CSS chunk moved to client |

**Largest client impact:** Intelligence workspace views moved from static to dynamic import.

---

## Code splitting changes

### Before
- All 14 workspace routes: `import { renderIntelligenceWorkspace } from "../services/intelligence-workspace-views"`
- Dashboard: 7 lazy chunks (already optimized)

### After
- Workspace routes: `lazy(() => import("../../services/intelligence-workspace-views"))`
- Initial `/app` navigation no longer pulls workspace view code

---

## Heavy dependencies (unchanged)

| Package | Usage |
|---------|-------|
| `@shopify/shopify-app-react-router` | App shell |
| Prisma client | Server-only |
| Intelligence UI | Workspace pages |

---

## Recommendations

1. **Per-workspace lazy modules** — split `intelligence-workspace-views.tsx` by `workspace.kind`
2. **Route-based splitting** — settings integrations could lazy-load Google/Clarity panels
3. **Tree-shake audit** — verify executive/prediction UI not in dashboard chunk

---

## Verification

Run `npm run build` and inspect `build/client/assets/*.js` chunk names after deploy.

**Production chunk timing:** NOT VERIFIED
