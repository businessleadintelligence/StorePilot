# Limit Matrix

Defined in `app/billing/plan-registry.ts` per-plan `limits`.

| Limit | Starter | Growth | Scale |
|-------|---------|--------|-------|
| products | 5,000 | 50,000 | unlimited |
| users | 1 | 5 | unlimited |
| stores | 1 | 1 | unlimited |
| ai_requests | 500 | 5,000 | unlimited |
| executive_briefings | 50 | unlimited | unlimited |
| predictions | 0 | 500 | unlimited |
| experiments | 0 | 100 | unlimited |
| sync_frequency_hours | 24 (daily) | 1 (hourly) | 1 |
| api_requests | 0 | 0 | unlimited |

Worker queue tiers: **standard** (starter), **normal** (growth), **priority** (scale).

Enforcement: `store-entitlements-loader.server.ts` + `entitlements.server.ts` + `ai-cost-control.server.ts`.
