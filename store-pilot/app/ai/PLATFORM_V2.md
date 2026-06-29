# StorePilot AI Platform v2

AI Operating System infrastructure for all StorePilot agents.

## Entry Point

All AI execution must go through:

```typescript
import { execute } from "./orchestrator/ai-orchestrator.server";

await execute({
  agent: "platform_template",
  storeId,
  context,
});
```

Direct provider calls from application code are forbidden.

## Privacy-by-Architecture

StorePilot is a business intelligence platform, not a CRM. Customer PII must not enter fact builders, prompts, cache keys, telemetry, or dashboards. Aggregated order and revenue metrics replace customer identity. Full policy: `docs/PRIVACY_BY_ARCHITECTURE.md`.

## Architecture

```
Shopify -> Database -> Deterministic Tools -> Fact Builder -> Prompt Builder
  -> Cache Lookup -> AI Orchestrator -> Provider -> Validation -> Persistence
  -> Recommendations -> Telemetry
```

## Modules

| Module | Purpose |
|---|---|
| `orchestrator/` | Single execution entry point |
| `execution/` | Run lifecycle state machine |
| `facts/` | Typed fact builders (no Prisma leakage) |
| `tools/` | Deterministic calculations (no LLM) |
| `builders/` | Prompt assembly from markdown + facts |
| `validation/` | Schema, business rules, retry policy |
| `cache/` | Fingerprint-based result reuse |
| `persistence/` | Runs, results, prompt versions, cache |
| `recommendations/` | Stable recommendation lifecycle |
| `memory/` | Merchant actions and dismissals |
| `telemetry/` | Execution observability + billing integration |

## Lifecycles

See diagrams in this document's source sections:

- Execution: pending -> running -> retry -> succeeded/failed/cached/skipped
- Recommendations: open -> viewed -> implemented/dismissed -> verified -> closed
- Cache: fingerprint match -> return cached result
- Prompts: immutable version rows with checksum
- Telemetry: one record per successful execution

## Database

Generic tables only:

- `ai_prompt_versions`
- `ai_agent_runs`
- `ai_agent_results`
- `ai_execution_telemetry`
- `ai_recommendations`
- `ai_memory_records`
- `ai_result_cache_entries`

## Product Intelligence

`product-facts.ts` and deterministic tools are implemented.

The Product Intelligence agent itself is **not** registered yet. Register it by adding an agent definition to `agents/agent-registry.ts` after prompt/schema files are added.

## Testing

```bash
npm test -- app/ai/tests/v2-
```
