# Causal Reasoning

Deterministic causal reasoning engine. Never AI.

## Reasoning types

| Type | Description |
|------|-------------|
| direct cause | Single-domain evidence signal |
| indirect cause | Multi-step causal chain |
| compound cause | Multiple required signals |
| contributing factor | Optional signal boost |
| root cause | Top-ranked primary cause |
| secondary cause | Supporting signal |
| cascade | Timeline-ordered consequence chain |

## Process

1. Analyze signals from evidence, patterns, baselines
2. Detect active outcome rules
3. Build causal chains with evidence IDs
4. Validate against business rules (reject impossible causes)
5. Validate against historical patterns
6. Score confidence deterministically
7. Assess impact and rank

## Business rules

- Inventory cannot explain traffic loss directly
- Page speed cannot explain refund spikes
- Traffic loss cannot explain inventory shortage

See `app/root-cause/rules/causal-rules.ts`.
