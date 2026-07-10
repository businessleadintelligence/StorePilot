# Causal Graph

Deterministic causal relationships with evidence-backed edges.

## Edge model

`causal_graph_edges` stores:

- `fromNodeId`, `toNodeId`, `relationLabel` (CAUSES)
- `evidenceIds`, `confidence`

## Chain example

```
Revenue → Conversion → Traffic → SEO → Missing Metadata
```

Each edge references evidence from the chain steps.

## Knowledge Graph integration

Reserved `CAUSES` edge type in knowledge graph aligns with causal graph edges. Sprint 6 materializes edges from deterministic chains; future sprints populate native graph traversal.
