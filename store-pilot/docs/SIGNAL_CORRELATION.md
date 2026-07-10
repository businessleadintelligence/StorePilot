# Signal Correlation

Deterministic cross-system signal correlation. No statistical hallucination.

## Relation types

| Type | Meaning |
|------|---------|
| positive | Same direction signals |
| negative | Opposing direction |
| inverse | Up vs down |
| temporal | Time-ordered (future) |
| cross_domain | Different operational domains |

## Strength formula

Based on signal magnitude, direction agreement, and domain overlap. Minimum threshold: 0.35.

## Persistence

`signal_correlations` keyed by `(storeId, correlationKey)`.

## API

```typescript
import { getSignalCorrelations } from "~/root-cause";
```
