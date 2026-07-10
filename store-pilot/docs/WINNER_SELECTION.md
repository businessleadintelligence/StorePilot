# Winner Selection

Modules:
- `app/experiments/winner-selection/winner-selector.ts`
- `app/experiments/execution/shadow-simulator.ts` (shadow comparisons)

## Outcomes

| Outcome | Condition |
|---------|-----------|
| `winner` | Best variant > tie threshold vs baseline |
| `loser` | Best variant underperforms baseline |
| `no_change` | Difference < 1.5% |
| `statistical_tie` | Top two variants within 1.5% |

## Comparison flow

```
Baseline → Variant → Difference → Confidence → Winner
```

## Shadow vs live

- **Shadow**: simulated from historical evidence (pre-approval)
- **Live**: incremental observations after merchant approval (Sprint 9 execution loop)

All deterministic. GPT never selects winners.
