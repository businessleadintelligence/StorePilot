# Navigation Performance — P1 Performance Sprint

---

## Target

**<300ms perceived latency** on sidebar workspace clicks.

---

## Before

1. Client navigation → loader runs
2. Auth + store lookup (duplicate with parent)
3. `loadWorkspaceShell` (8 queries) **sequential** then workspace queries
4. Full `intelligence-workspace-views` bundle parsed
5. Page renders when **everything** completes

---

## After

1. Client navigation → `.data` request (React Router)
2. Auth + store via **shared request context** (deduped with layout)
3. Shell + workspace queries **parallel**
4. Workspace views **lazy-loaded** chunk
5. Document deep-links: instant shell skeleton → `.data` fills content

---

## Per-route isolation

Each sidebar item loads **only its workspace loader** — no preloading of other workspaces.

| Route | Loader factory |
|-------|----------------|
| Executive | `createIntelligenceWorkspaceLoader` |
| Predictions | `createFeatureGatedWorkspaceLoader` |
| Products | `createIntelligenceWorkspaceLoader` |

No cross-workspace prefetch on dashboard mount.

---

## Expected improvement

| Metric | Estimate |
|--------|----------|
| Auth + store dedup | −50–150ms |
| Parallel shell | −200–400ms |
| Lazy chunk (repeat visits cached) | −100–300ms first visit |

**Production timings:** NOT VERIFIED

---

## Future

- Prefetch on sidebar hover (optional, low priority)
- Service worker cache for static workspace chrome
