# Graph Integrity

The Integrity Engine (`app/knowledge/graph/integrity/integrity-engine.ts`) validates graph consistency after every build.

## Checks

| Code | Severity | Detection |
|------|----------|-----------|
| `broken_edge` | high | Edge references missing node |
| `self_loop` | medium | Edge from node to itself |
| `missing_evidence` | high | Active edge without evidenceId |
| `duplicate_node` | medium | Multiple active nodes with same canonical key |
| `expired_evidence` | medium | Edge references inactive evidence |
| `orphan_node` | low | Node with no active edges (excludes Store) |

## Integrity Score

```
integrityScore = max(0, 1 - (issueCount × 0.02))
```

Persisted to `knowledge_graph_integrity` after each build.

## Repair

`repairGraphIntegrity(storeId)` safely:

1. Deactivates edges missing evidence binding
2. Deactivates edges referencing expired evidence
3. Records `lastRepairedAt` timestamp

Repair never deletes nodes or edges — deactivation preserves audit trail.

## Metrics Integration

Integrity runs after metrics computation in the builder pipeline. Low integrity scores should block downstream AI recommendations in future sprints.

## Circular Reference Detection

Self-loops are flagged. Multi-node cycles are detected via orphan/component analysis in metrics. Dedicated cycle repair is planned for Sprint 4.
