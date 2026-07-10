# Dependency Graph — StorePilot Phase A

**Date:** 2026-07-10

---

## Layer Dependency (Mermaid)

```mermaid
flowchart TB
  subgraph L0_External
    Shopify[Shopify Admin API]
    OpenAI[OpenAI API]
    Google[Google APIs]
    Vercel[Vercel Platform]
  end

  subgraph L1_Infrastructure
    DB[(PostgreSQL + Prisma)]
    Queue[sync_jobs Queue]
    Sessions[Encrypted Session Storage]
  end

  subgraph L2_Services
    Sync[orders/product sync]
    Jobs[job/worker services]
    GDPR[gdpr.server.ts]
    Billing[billing.server.ts]
    IntelUI[intelligence-workspace]
  end

  subgraph L3_DomainEngines
    Knowledge[knowledge/graph]
    Learning[learning/historical]
    Executive[executive/decision]
    RootCause[root-cause]
    Prediction[prediction]
    Experiments[experiments]
    MerchantMI[merchant-intelligence]
  end

  subgraph L4_AI
    Foundation[ai/foundation]
    Orchestrator[ai/orchestrator V2]
    Providers[ai/providers/openai]
  end

  subgraph L5_Presentation
    Routes[app/routes]
    Components[components + intelligence-ui]
  end

  Routes --> IntelUI
  Routes --> Sync
  Routes --> GDPR
  Components --> IntelUI
  IntelUI --> L3_DomainEngines
  Sync --> Shopify
  Sync --> DB
  Jobs --> Queue
  Jobs --> L3_DomainEngines
  L3_DomainEngines --> DB
  L3_DomainEngines --> Foundation
  L3_DomainEngines --> Knowledge
  Executive --> Orchestrator
  Executive --> Foundation
  Orchestrator --> Providers
  Foundation --> Providers
  Providers --> OpenAI
  Jobs --> DB
  GDPR --> DB
  Billing --> Shopify
```

---

## Intelligence Pipeline Dependency

```mermaid
flowchart LR
  subgraph Ingestion
    WH[Webhooks] --> Sync
    Sync --> Facts[Evidence/Facts]
  end

  Facts --> KG[Knowledge Graph Build]
  KG --> HI[Historical Intelligence]
  HI --> BM[Business Memory]
  BM --> QW[Quick Wins]
  QW --> ED[Executive Decisions]
  ED --> RC[Root Causes]
  RC --> PR[Predictions]
  PR --> EX[Experiments]
  EX --> COO[Executive COO]
  COO --> MI[Merchant Intelligence]
  MI --> UI[Intelligence Workspaces]
```

---

## Module Coupling Hotspots

| Module | Fan-In | Fan-Out | Risk |
|--------|--------|---------|------|
| `db.server.ts` | Very high | 1 (packages/database) | Expected |
| `worker.server.ts` | Medium | All domain schedulers | God dispatcher |
| `intelligence-workspace.server.ts` | Low | 8+ domain APIs | Growing aggregator |
| `shopify.server.ts` | High | Auth + billing + onboarding | Bootstrap complexity |
| `ai/orchestrator` | 9 services | providers + prisma | Bypass hub |

---

## Cross-Layer Violations (Dependency)

```mermaid
flowchart LR
  subgraph Violations["⚠️ Violations"]
    V2Services["9 *-intelligence.server.ts"] -->|bypass| Orchestrator
    Orchestrator -->|skips| Foundation
    Onboarding -->|uses| V2COO["executive-coo.server.ts"]
    Scheduler -->|uses| FoundationCOO["coo-service.ts"]
  end

  subgraph Correct["✅ Correct Path"]
    FoundationCOO --> Foundation
    ExplanationService --> Foundation
    DeterministicEngines --> DB
  end
```

---

## Package Dependencies

```
store-pilot/
├── app/                    (main application)
├── packages/database/      (Prisma instrumentation, pooling, retry)
├── prisma/                 (schema, migrations)
├── scripts/                (worker, deploy, audit)
└── extensions/*            (workspace — empty)
```

**External runtime deps:** react, react-router, @shopify/*, @prisma/client, openai, zod

---

## Recommended CI Additions

1. `madge --circular app/` — detect circular imports
2. `dependency-cruiser` — enforce layer rules (routes → services → domain → db)
3. Bundle size budget on `react-router build`

---

## Module Count Summary

| Area | Files (approx) |
|------|----------------|
| app/ total TS/TSX | ~1,217 |
| Route modules | 56 |
| Service *.server.ts | 87 |
| Test files | 273 |
| Prisma models | 112 |
| Docs (architecture) | 81 |
