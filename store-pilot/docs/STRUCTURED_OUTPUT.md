# Structured Output

The foundation platform **never parses free text**. Every provider response must become validated JSON before returning to callers.

## Flow

1. Provider returns raw string (`rawContent`)
2. `runStructuredOutputEngine` extracts JSON from prose if needed
3. Zod schema validation via `validateStructuredOutput`
4. On failure: JSON repair (`attemptJsonRepair`) up to `maxRepairAttempts`
5. On continued failure: throw `schema_validation_failed`
6. Pipeline may retry the full provider call on validation errors (`maxValidationRetries`)

## Strict mode

```typescript
output: {
  schema: mySchema,
  schemaName: "my.output",
  strict: true,              // default
  maxRepairAttempts: 2,      // default
  maxValidationRetries: 1,   // default
}
```

## JSON repair

`structured-output/json-repair.ts` handles common provider mistakes:

- Markdown code fences
- Trailing commas
- Unquoted object keys

Repair is deterministic and logged via `usedRepair` / `repairAttempts` in engine result.

## Response validation (post-schema)

After Zod validation, `response-validator` applies business rules:

| Rule              | Behavior                          |
|-------------------|-----------------------------------|
| `confidence_range`| Must be 0–1 if present            |
| `priority_range`  | Must be 1–5 if present            |
| Unknown fields    | Rejected via `rejectUnknownFields`|
| Enum fields       | Validated via `validateEnumField` |

Agents can register additional `FoundationValidationRule` instances in Sprint 2.

## Provider structured mode

| Provider   | Structured strategy                    |
|------------|----------------------------------------|
| OpenAI     | `response_format: json_object`         |
| Anthropic  | JSON mode via messages API             |
| Gemini/Grok| Stub — not yet implemented             |

## Example

```typescript
import { z } from "zod";
import { runStructuredOutputEngine } from "~/ai/foundation/structured-output/engine";

const schema = z.object({
  category: z.enum(["urgent", "normal", "low"]),
  confidence: z.number().min(0).max(1),
});

const result = runStructuredOutputEngine(rawProviderText, {
  schema,
  schemaName: "ticket.classification",
});

console.log(result.data, result.usedRepair);
```

## Error codes

| Code                           | Retryable | Pipeline action        |
|--------------------------------|-----------|------------------------|
| `invalid_response`             | No        | Fail or validation retry |
| `schema_validation_failed`     | No        | Validation retry       |
| `business_rule_validation_failed` | No     | Validation retry       |

## Sprint 2 guidance

- Define one Zod schema per prompt output version.
- Never use regex or string parsing on model output in agent code.
- Prefer nano tier + small schemas for extraction tasks.
