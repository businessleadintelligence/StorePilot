# Frontend Architecture Audit — StorePilot Phase A

**Date:** 2026-07-10

---

## Stack

- React 18 + React Router 7 (file-based routes)
- Shopify embedded app (App Bridge, Polaris web components)
- Server loaders for data fetching (no client-side fetch waterfalls on primary routes)
- Sprint 10 intelligence-ui layer for workspace UX

---

## Component Reuse

| Layer | Assessment |
|-------|------------|
| `app/intelligence-ui/` | New shared workspace system — good reuse foundation |
| Dashboard cards | Domain-specific (`executive/ui`, `prediction/ui`, etc.) — consistent pattern |
| Legacy components | `CommandCenter.tsx`, `ExecutiveDashboard.tsx` — parallel to new workspaces |
| Badges/formatting | Some duplication between domain UI and intelligence-ui |

**Gap:** Two parallel executive experiences — legacy COO dashboard vs intelligence workspace.

---

## Routing Architecture

```
app/routes/app.tsx          → Shell + nav
app/routes/app._index.tsx   → Dashboard launchpad
app/routes/app.*.tsx        → 30 app routes including 14 intelligence workspaces
```

**Strengths:**
- Thin route files delegating to services
- Error boundaries on intelligence routes
- Breadcrumb + flow navigation consistent across workspaces

**Gaps:**
- Placeholder routes still reachable (`app.issues`, `app.reports`, `app.additional`)
- Nav has 20+ links — may overwhelm merchants

---

## State Management

| Pattern | Usage |
|---------|-------|
| React Router loaders | Primary data source |
| Context | `IntelligenceWorkspaceProvider` for drawer/flow/command |
| Local useState | Executive COO drawer, command palette |
| No Redux/Zustand | Appropriate for current scale |

---

## Accessibility

| Feature | Status |
|---------|--------|
| Flow nav `aria-current="step"` | ✅ intelligence-ui |
| Evidence drawer `role="dialog"` | ✅ |
| Breadcrumbs `aria-label` | ✅ |
| Timeline semantic `<ol>` | ✅ |
| Keyboard shortcuts | Ctrl+K search — ✅ |
| Progress bars `role="progressbar"` | ✅ existing gauges |
| Dark mode | Relies on Shopify/Polaris theming — not custom tested |
| Screen reader testing | No automated a11y test suite |

**Recommendation:** Add `@axe-core/react` or Playwright a11y checks for workspace routes.

---

## Mobile Strategy

- Responsive CSS in `intelligence-workspace.module.css` — split layout collapses at 960px
- Shopify embedded app primarily desktop — mobile is secondary
- Polaris web components handle responsive patterns

---

## Fetchers & Actions

| Route | Actions |
|-------|---------|
| `app.experiments.tsx` | Approve/dismiss experiments |
| `app.executive.tsx` (intelligence) | Loader only |
| `app.coo.tsx` (legacy) | Recommendation feedback actions |

**Gap:** Dashboard experiment cards have Approve/Dismiss buttons without `useFetcher` wiring.

---

## Frontend Score: 87/100

Strong Sprint 10 workspace architecture. Deductions for legacy parallel UIs, placeholder routes, and limited a11y automation.

---

## Recommendations

| Priority | Item | Effort |
|----------|------|--------|
| 🟠 High | Wire experiment actions on dashboard cards | 1-2 days |
| 🟠 High | Consolidate legacy COO + intelligence executive | 3-5 days |
| 🟡 Medium | Add list virtualization | 2 days |
| 🟡 Medium | Reduce nav link count (group under "More") | 1 day |
| 🟢 Low | Add Storybook for intelligence-ui components | 3-5 days |
