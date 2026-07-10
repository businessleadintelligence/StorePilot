# AI Cost Control (Foundation)

Foundation cost management tracks token usage and estimated USD per request, enforces merchant budgets via automatic tier downgrade, and persists records for reporting.

## Tracked fields

Each `CostLedgerEntry` records:

| Field              | Description                    |
|--------------------|--------------------------------|
| `storeId`          | Merchant store UUID            |
| `merchantId`       | Optional merchant reference    |
| `agentId`          | Optional agent identifier      |
| `feature`          | Feature flag / use case        |
| `providerId`       | openai, anthropic, …           |
| `modelId`          | Resolved model from tier binding |
| `modelTier`        | reasoning / standard / fast / nano |
| `promptTokens`     | Input tokens                   |
| `completionTokens` | Output tokens                  |
| `totalTokens`      | Sum                            |
| `latencyMs`        | End-to-end latency             |
| `estimatedCostUsd` | Tier rate × tokens             |
| `cacheHit`         | Whether provider was skipped   |
| `success`          | Request outcome                |

## Storage

| Store                    | When to use              |
|--------------------------|--------------------------|
| `InMemoryCostLedger`     | Tests, local dev         |
| `PrismaCostLedgerStore`  | Production               |

Tables: `ai_cost_ledger`, `ai_merchant_budgets`.

## Budget rules

`AiMerchantBudget` per store:

- `monthlyBudgetUsd` — default $100
- `softLimitPercent` — alert threshold (default 80%)
- `hardLimitPercent` — hard cap marker (default 100%)

**Automatic downgrade** (not hard block) is handled by model router:

```
≥ 70% monthly spend → downgrade reasoning to standard
≥ 85%             → downgrade one more tier step
≥ 95%             → force nano tier
```

Merchants continue receiving AI responses; quality scales down invisibly.

## Cost estimation

Rates configured per tier via env (see `.env.example`):

```
AI_TIER_NANO_PROMPT_USD_PER_1K=0.0001
AI_TIER_NANO_COMPLETION_USD_PER_1K=0.0004
```

```typescript
import { CostManager } from "~/ai/foundation/cost/cost-manager";

const manager = new CostManager({ ledger: createPrismaCostLedgerStore() });

const usd = manager.estimateCost({
  tier: "standard",
  promptTokens: 1500,
  completionTokens: 800,
});
```

## Merchant snapshot

```typescript
const spend = await manager.getMerchantSnapshot(storeId);
// dailySpendUsd, monthlySpendUsd, monthlyBudgetUsd, budgetPercentUsed
```

Used by pipeline before every request to apply downgrade policy.

## Metrics dashboard fields

`FoundationMetricsCollector.snapshot()` exposes:

- Average latency
- Cache hit rate
- Total tokens / cost
- Failure rate / retry rate
- Provider uptime counts
- Model distribution
- Daily / monthly spend

## Relationship to existing billing

`app/services/ai-cost-control.server.ts` (execution credits per plan) remains separate. Foundation ledger tracks **USD/token economics** for platform operations. Sprint 2 should unify reporting dashboards.

## Sprint 2 checklist

- [ ] Seed `ai_merchant_budgets` on store creation
- [ ] Alert webhooks at soft/hard limits
- [ ] Admin UI for budget overrides
- [ ] Reconcile estimated vs actual provider invoices
