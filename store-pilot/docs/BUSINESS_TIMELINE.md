# Business Timeline

Reusable causal timeline for Prediction Engine and Business Simulation.

## Structure

Each timeline event contains:

- `eventId`, `dayOffset`, `label`, `signal`
- `evidenceIds`, `role` (event | signal | cause | consequence)

## Example

```
Day -2: Inventory dropped
Day -1: Product unavailable
Day  0: Revenue declined
```

## Persistence

`causal_timelines` per root cause, aggregated via `getBusinessTimeline()`.

## Consumers

- Root Cause UI
- Executive COO (via business context)
- Future Prediction Engine
- Future Business Simulation
