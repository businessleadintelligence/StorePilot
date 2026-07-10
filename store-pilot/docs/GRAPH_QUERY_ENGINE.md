# Graph Query Engine

Pure graph traversal — no AI reasoning. Located at `app/knowledge/graph/query/`.

## Capabilities

| Method | Description |
|--------|-------------|
| `findNeighbors` | BFS neighborhood up to configurable depth |
| `depthSearch` | Ordered depth-first expansion |
| `shortestPath` | Unweighted BFS shortest path |
| `influenceScore` | Node weight from neighborhood size + edge weights |
| `findConnectedComponents` | Component count via metrics |
| `getNodesByType` | Filter nodes by type |

## Resolver Views

`graph-resolver.ts` provides domain-specific entry points:

- `getProductGraph(productId)`
- `getCollectionGraph(collectionId)`
- `getVendorGraph(vendorId)`
- `getRevenueGraph()` — order/revenue subgraph
- `getInventoryGraph()` — inventory dimension subgraph
- `findDependencies(nodeId)`
- `relationshipExpansion(nodeId, relationship)`

## Usage

```typescript
import { createKnowledgeGraphApi } from "~/knowledge/graph";

const api = createKnowledgeGraphApi(storeId);
const productGraph = await api.getProductGraph("100");
const path = await api.shortestPath(fromNodeId, toNodeId);
const score = await api.influenceScore(nodeId);
```

## Limits

| Constant | Value | Purpose |
|----------|-------|---------|
| `MAX_GRAPH_TRAVERSAL_DEPTH` | 5 | Prevent runaway traversal |
| `MAX_GRAPH_NEIGHBORHOOD` | 500 | Cap memory per query |

## Caching

`graph-cache.ts` provides in-memory neighborhood caching keyed by `(storeId, nodeId, depth)`. Invalidate on incremental graph updates.

## Future Consumers

The `FutureEngineGraphConsumer` interface in `graph-api.ts` defines the contract for:

- Learning Engine
- Executive COO
- Prediction Engine
- Experiment Center
- Business Simulator
- Automation Engine
- Root Cause Engine
