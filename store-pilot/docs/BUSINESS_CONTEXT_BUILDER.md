# Business Context Builder

Produces the only context payload the Executive COO receives.

## Sections

| Section | Source |
|---------|--------|
| businessSummary | Learning readiness, quick wins, graph stats |
| storeHealth | Operational readiness dimensions |
| businessDna | Latest `business_dna_versions` |
| topRisks | Ranked decisions (risk/critical) |
| topOpportunities | Revenue-impact decisions |
| priorityDecisions | Top 12 executive decisions |
| revenueOpportunities | Structured opportunity list |
| historicalContext | Memory, patterns, baselines |
| merchantProfile | Priorities, domain confidence |
| operationalReadiness | Full readiness record |
| recentChanges | Latest quick win signals |
| predictionReadiness | Score + ready flag |
| experimentReadiness | Score + candidate count |

## Rules

- No raw Shopify records
- No customer PII
- Deterministic JSON only
- Hash stored in `business_context_snapshots.contextHash`

## Reuse

Same builder is consumed by:

- Executive COO
- Future Root Cause Engine
- Prediction Engine
- Experiment Center
- AI Chat
