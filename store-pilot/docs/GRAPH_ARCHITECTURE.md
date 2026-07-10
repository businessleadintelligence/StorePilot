# Graph Architecture

## System Position

The Knowledge Graph sits between evidence ingestion and all intelligence capabilities.

```mermaid
flowchart LR
  subgraph Current
    S1[Shopify] --> K1[Knowledge Ingestion]
    K1 --> E1[Evidence Store]
    E1 --> AI1[AI - legacy direct]
  end

  subgraph Target
    S2[Shopify] --> K2[Knowledge Ingestion]
    K2 --> E2[Evidence Store]
    E2 --> G[Knowledge Graph]
    G --> LE[Learning Engine]
    LE --> AIF[AI Foundation]
    AIF --> COO[Executive COO]
    COO --> AUTO[Automation]
  end
```

Sprint 3 implements **G** only. Downstream boxes expose interfaces, not implementations.

## Builder Pipeline

```mermaid
flowchart TD
  A[Evidence Batch] --> B[Relationship Engine]
  B --> C[Upsert Nodes]
  B --> D[Upsert Edges]
  B --> E[Semantic Relationships]
  C --> F[Search Index]
  D --> G[Metrics]
  G --> H[Business DNA Node]
  G --> I[Integrity Check]
  I --> J{More Evidence?}
  J -->|Yes| K[Checkpoint Cursor]
  K --> A
  J -->|No| L[Version Bump + Snapshot]
```

## Incremental Update Pipeline

```mermaid
sequenceDiagram
  participant WH as Shopify Webhook
  participant SP as StorePilot Handler
  participant SCH as Graph Scheduler
  participant WRK as Worker
  participant BLD as Graph Builder
  participant DB as PostgreSQL

  WH->>SP: products/update
  SP->>SP: Upsert product + evidence
  SP->>SCH: scheduleIncrementalGraphUpdate
  SCH->>WRK: knowledge_graph_incremental job
  WRK->>BLD: runIncrementalGraphUpdate(scope=Product)
  BLD->>DB: Upsert affected nodes/edges only
  BLD->>DB: Update metrics + integrity
```

## Node Hierarchy

```mermaid
flowchart TD
  Store --> Collection
  Store --> Product
  Product --> Variant
  Product --> InventoryItem
  Product --> Price
  Product --> SeoRecord
  Product --> Evidence
  Order --> Refund
  Store --> BusinessDNA
```

## Technology Choices

| Decision | Rationale |
|----------|-----------|
| PostgreSQL tables | Matches existing stack; domain graph is bounded |
| Normalized schema | Referential integrity, auditability |
| Application-layer BFS | Sufficient for V1 traversal depths |
| Checkpoint batching | Memory-efficient builds at 100k+ products |
| Evidence binding on edges | Explainability for future AI |

## Performance Strategy

- Batch size: 100 evidence rows per builder pass
- Checkpoint resume via `KnowledgeGraphBuildCheckpoint.evidenceCursor`
- Scoped incremental rebuild by `entityType + entityId`
- Neighborhood cache for repeated query patterns

## Security Boundary

Nodes are **never** created for: Customer, Email, Phone, Address, Payment, or customer behavior. Only operational business intelligence.
