# Operations Queue

Converts executive decisions into operational tasks.

## Task statuses

`pending` | `approved` | `in_progress` | `completed` | `ignored` | `deferred` | `cancelled`

## Each task tracks

- Decision source (`decisionId`)
- Evidence IDs
- Graph node IDs (when available)
- Business memory IDs
- Business impact, effort, time, confidence
- Outcome JSON (future learning hook)

## Conversion

`convertDecisionsToTasks()` maps each ranked decision to a `decision_tasks` row.

## Regeneration

Pending tasks are replaced on each decision engine run. Non-pending tasks are preserved.

## API

```typescript
import { getOperationsQueue } from "~/executive";

const queue = await getOperationsQueue(storeId);
```
