# AI Cost Operations Audit

## Current State

StorePilot has two AI cost concepts: plan credit enforcement in `ai-cost-control.server.ts`, and Foundation USD/token cost management described in `docs/AI_COST_CONTROL.md`. Tier routing uses reasoning, standard, fast, and nano tiers. `.env.example` sets reasoning to GPT-5 and cheaper tiers to smaller models.

## Strengths

- Plan-level AI credit debit uses transactional serialized enforcement.
- Alert levels exist at 80%, 90%, and limit reached.
- Foundation design includes token usage, estimated USD, cache hit, latency, model tier, and budget snapshots.
- Tier routing can downgrade expensive requests as budget usage increases.
- AI health checks exist.

## Weaknesses

- Foundation alert webhooks are explicitly incomplete.
- USD/token ledger production wiring is not fully proven by this audit.
- Provider pricing is env-configured and can drift from actual invoices.
- No cost spike alert exists.
- No global platform-level spend cap was found.
- Prompt bypass prevention is not certified across every AI call path.
- GPT-5 is configured as the reasoning tier; cheap tasks must be forced through fast/nano routing.

## Risk Level

High. One merchant is unlikely to bypass plan credits where credit enforcement is used, but AI paths not using the budget guard or Foundation router can still create spend risk.

## Monthly Cost Estimate

Assumption: 30 AI-assisted operations per store per month, average 4,000 tokens, blended $0.0015 per 1K tokens after tier routing. Heavy Executive COO usage can exceed this significantly.

| Stores | Estimated monthly AI cost |
|---:|---:|
| 100 | $18 |
| 1,000 | $180 |
| 10,000 | $1,800 |
| 100,000 | $18,000 |

Stress case at $0.02 per 1K blended reasoning usage and 200 monthly operations per store:

| Stores | Stress monthly AI cost |
|---:|---:|
| 100 | $1,600 |
| 1,000 | $16,000 |
| 10,000 | $160,000 |
| 100,000 | $1,600,000 |

## Recommendations

- Enforce one AI gateway for all provider calls.
- Add platform-wide daily and monthly spend caps.
- Add per-merchant USD budget in addition to credits.
- Add soft/hard alert webhooks.
- Reconcile estimated costs with provider invoices weekly.
- Add tests proving cheap task categories cannot route to reasoning/GPT-5.

## Priority

P1.

## Estimated Engineering Effort

2 to 4 weeks.
