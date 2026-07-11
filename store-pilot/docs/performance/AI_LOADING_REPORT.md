# AI Loading Report — P1 Performance Sprint

---

## Architectural principle

> Executive, Predictions, Experiments, Merchant Intelligence, Knowledge Graph, and Business Memory are **separate applications** — not part of the initial page.

---

## Dashboard AI sections

| Section | Loading strategy |
|---------|------------------|
| Executive cards | Deferred on document SSR; `.data` fetch |
| Predictions | Same |
| Experiments | Same |
| Root cause | Same |
| Merchant intelligence | Same |
| Learning bootstrap | Same |
| Quick wins | Same |

**UI:** `<Suspense>` + `<Await>` + skeleton placeholders  
**Trigger:** Client `revalidate()` after hydration when `deferIntelligenceLoad: true`

---

## Workspace routes (new this sprint)

| Pattern | Implementation |
|---------|----------------|
| Document SSR | Currency shell only, `deferWorkspaceLoad: true` |
| Client revalidation | `IntelligenceWorkspaceRoute` → `revalidate()` |
| View code | Lazy import of workspace views |
| Fallback | `DeferredSectionSkeleton` |

Applies to: Executive, Predictions, Experiments, Root Cause, Merchant Intelligence, Knowledge Graph, Business Memory, Products, Collections, Inventory, Pricing, SEO, Timeline.

---

## What never blocks initial paint

- Executive dashboard data
- Prediction / experiment engines
- Knowledge graph statistics
- Business memory snapshots
- Merchant intelligence profile

---

## Production verification

| Criterion | Status |
|-----------|--------|
| AI sections show skeleton then populate | ⏳ NOT VERIFIED |
| No SSR abort on fresh install | ✅ P0 guard retained |
| Workspace deep-link opens shell first | Architecture in place |
