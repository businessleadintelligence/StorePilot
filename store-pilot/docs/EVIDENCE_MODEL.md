# Evidence Model

## Tables

### `evidence`

Primary fact store. Unique on `(storeId, entity, entityId, factType)`.

### `evidence_history`

Append-only audit trail with `changeType`: `created`, `updated`, `expired`.

### `evidence_sources`

Tracks provenance (`shopify`, ref=`initial_import`, etc.) and source priority.

### `evidence_relationships`

Links related evidence (e.g. product ↔ collection facts).

### `evidence_observations`

Individual observations with dedupe keys to prevent duplicate ingest.

## Example records

```json
{
  "entity": "Variant",
  "entityId": "40123456789",
  "factType": "InventoryLow",
  "value": { "quantity": 5 },
  "confidence": 0.95,
  "freshnessMinutes": 3,
  "source": "shopify"
}
```

```json
{
  "entity": "Product",
  "entityId": "70123456789",
  "factType": "MissingMetaDescription",
  "value": null
}
```

## Quality dimensions

| Dimension | Meaning |
|-----------|---------|
| Confidence | Overall trust in fact |
| Freshness | Minutes since `observedAt` |
| Completeness | Input field coverage |
| Reliability | Derived from completeness |
| Observation Count | Incremented on each upsert |
| Source Priority | Shopify = 100 |

## API

```typescript
import { createEvidenceStore } from "~/knowledge";

const store = createEvidenceStore();
const sourceId = await store.ensureSource({
  storeId,
  sourceType: "shopify",
  sourceRef: "incremental",
});
await store.upsertEvidence({ storeId, draft, sourceId });
```
