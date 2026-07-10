# Model Routing

StorePilot never allows callers to hardcode model names. All routing goes through **task category → tier → provider/model binding**.

## Tiers

| Tier       | Purpose                                      | Default model (OpenAI) |
|------------|----------------------------------------------|------------------------|
| `reasoning`| Executive reasoning, diagnosis, simulation   | `gpt-5`                |
| `standard` | Reports, recommendations, summaries          | `gpt-4.1`              |
| `fast`     | Daily reports, rewrites, short summaries       | `gpt-4.1-mini`         |
| `nano`     | Classification, extraction, validation       | `gpt-4.1-nano`         |

Configuration lives in `app/ai/foundation/model-router/model-config.ts` and is overridden via environment variables:

```
AI_TIER_{TIER}_PROVIDER=openai|anthropic|...
AI_TIER_{TIER}_MODEL=<model-id>
```

Switching providers (e.g. Anthropic for fast tier) requires only env changes:

```
AI_TIER_FAST_PROVIDER=anthropic
AI_TIER_FAST_MODEL=claude-3-5-haiku-latest
```

## Task category map

Defined in `TASK_TIER_MAP`:

| Task category              | Tier       |
|----------------------------|------------|
| `executive_reasoning`      | reasoning  |
| `cross_system_diagnosis`   | reasoning  |
| `business_simulation`      | reasoning  |
| `strategic_planning`       | reasoning  |
| `root_cause_reasoning`     | reasoning  |
| `report_writing`           | standard   |
| `recommendation_generation`| standard   |
| `executive_summary`        | standard   |
| `daily_report`             | fast       |
| `short_summary`            | fast       |
| `rewrite`                  | fast       |
| `classification`           | nano       |
| `extraction`               | nano       |
| `tagging`                  | nano       |
| `validation`               | nano       |
| `json_repair`              | nano       |

Callers pass `context.taskCategory` on every foundation request.

## Budget downgrade policy

When monthly spend exceeds thresholds, tiers downgrade automatically (`routing-policy.ts`):

| Budget used | Effect                                      |
|-------------|---------------------------------------------|
| < 70%       | Requested tier                              |
| ≥ 70%       | Reasoning → Standard                        |
| ≥ 85%       | Downgrade 1 additional step                 |
| ≥ 95%       | Force nano tier                             |

Merchants never see errors from downgrade — responses continue with lower-capability models.

## API

```typescript
import { resolveModelRoute } from "~/ai/foundation/model-router/routing-policy";

const route = resolveModelRoute({
  taskCategory: "executive_summary",
  monthlyBudgetUsd: 100,
  monthlySpendUsd: 72,
});

// route.resolvedTier, route.route.providerId, route.route.modelId
// route.downgraded === true
```

## Rules for Sprint 2+ agents

1. Never import model names in agent code.
2. Always declare the correct `taskCategory` for the operation.
3. Use `response.modelTier` and `response.downgradedTier` for observability only.
4. Update `TIER_MODEL_BINDINGS` defaults or env vars when new models ship — not agent logic.
