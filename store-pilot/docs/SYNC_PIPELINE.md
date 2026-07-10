# Sync Pipeline

## Modes

| Mode | Description |
|------|-------------|
| `initial_import` | First evidence build after product bootstrap |
| `incremental` | Cursor-based batch continuation |
| `manual_rebuild` | Full refresh enqueue |
| `evidence_refresh` | Re-upsert evidence from stored data |
| `fact_refresh` | Products only, skip order collection |
| `webhook_resume` | High-priority partial resume |

## Checkpoints

Stored in `knowledge_sync_checkpoints`:

- `productCursor`, `orderCursor`, `inventoryCursor`, `collectionCursor`
- `productsProcessed`, `ordersProcessed`, `evidenceCreated`
- `status`: `idle` | `running`

## Worker flow

1. `bootstrap_products` completes → enqueue `knowledge_ingest` (`initial_import`)
2. Worker runs `executeKnowledgeIngestJob`
3. Pipeline processes one batch (default 50 products)
4. If `hasMoreWork`, worker enqueues continuation job
5. `persistKnowledgeReadiness` updates domain percentages

## Scheduling API

```typescript
import {
  scheduleKnowledgeIngestJob,
  scheduleIncrementalKnowledgeImport,
  scheduleManualKnowledgeRebuild,
  scheduleEvidenceRefresh,
  scheduleWebhookResumeKnowledgeImport,
} from "~/knowledge";
```

## Events emitted (no consumers yet)

- `ProductImported`, `InventoryUpdated`, `OrderImported`
- `ProductArchived`, `ProductDeleted`
- `EvidenceCreated`, `EvidenceUpdated`, `EvidenceExpired`

Logged via `KnowledgeEventEmitter` → `[knowledge-event]` console + in-memory sink for tests.

## Rate limits

Shopify collector uses exponential backoff on 429/throttle errors (4 retries, 500ms base).

## Idempotency

- Jobs: idempotency keys per store/mode/batch
- Observations: unique `(storeId, dedupeKey)`
- Evidence: upsert on `(storeId, entity, entityId, factType)`
