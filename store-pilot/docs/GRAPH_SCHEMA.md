# Graph Schema

PostgreSQL-native normalized graph tables managed by Prisma.

## Entity Relationship

```mermaid
erDiagram
  Store ||--o{ KnowledgeGraphNode : owns
  Store ||--o| KnowledgeGraphMetadata : has
  Store ||--o| KnowledgeGraphBuildCheckpoint : tracks
  KnowledgeGraphNode ||--o{ KnowledgeGraphEdge : from
  KnowledgeGraphNode ||--o{ KnowledgeGraphEdge : to
  KnowledgeGraphNode ||--o{ KnowledgeGraphRelationship : from
  KnowledgeGraphNode ||--o{ KnowledgeGraphRelationship : to
  Evidence ||--o{ KnowledgeGraphEdge : proves
  Evidence ||--o{ KnowledgeGraphRelationship : proves
  Store ||--o{ KnowledgeGraphVersion : versions
  KnowledgeGraphVersion ||--o| KnowledgeGraphSnapshot : captures
```

## Tables

### `knowledge_graph_nodes`

| Column | Purpose |
|--------|---------|
| `id` | UUID primary key |
| `storeId` | Tenant isolation |
| `nodeType` | Business entity enum |
| `canonicalKey` | Stable external identifier |
| `displayName` | Human-readable label |
| `status` | active / archived |
| `version` | Node revision counter |
| `confidence` | Aggregated confidence |
| `metadata` | JSON business attributes |
| `evidenceId` | Optional direct evidence link |

**Unique:** `(storeId, nodeType, canonicalKey)`

### `knowledge_graph_edges`

| Column | Purpose |
|--------|---------|
| `fromNodeId`, `toNodeId` | Directed edge endpoints |
| `relationship` | Typed edge enum |
| `confidence`, `strength`, `weight` | Traversal weighting |
| `source` | Creating subsystem |
| `evidenceId`, `evidenceVersion`, `evidenceSource` | Provenance |
| `observationCount`, `freshnessMinutes` | Evidence quality |
| `expiresAt`, `active` | Lifecycle |

**Unique:** `(storeId, fromNodeId, toNodeId, relationship)`

### Supporting Tables

- `knowledge_graph_relationships` — semantic labels on top of edge types
- `knowledge_graph_versions` — monotonic version history
- `knowledge_graph_snapshots` — immutable point-in-time captures
- `knowledge_graph_metadata` — builder status and current version
- `knowledge_graph_integrity` — latest integrity report
- `knowledge_graph_statistics` — computed graph metrics
- `knowledge_graph_search_index` — fast lookup tokens
- `knowledge_graph_build_checkpoint` — batch resume cursor

## Migration

`prisma/migrations/20260709210000_knowledge_graph_platform/migration.sql`

## Node Types

Store, Product, Variant, Collection, InventoryItem, Vendor, Location, Order, Price, Refund, SeoRecord, Media, Experiment, Evidence, Recommendation, OperationalIssue, TrafficSource, BusinessDNA, Decision, Outcome

## Edge Types

BELONGS_TO, CONTAINS, USES, CREATES, AFFECTS, DEPENDS_ON, CAUSES, SUPPORTS, GENERATES, OBSERVED_BY, MEASURED_BY, LEARNS_FROM, PREDICTS, RESULTED_IN, CONNECTED_TO, RELATED_TO

## Design Principles

- **No denormalization** in core tables — snapshots hold denormalized copies
- **Referential integrity** via foreign keys with cascade delete
- **Evidence required** on all active edges (enforced by integrity engine)
