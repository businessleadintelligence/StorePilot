# Prompt Registry

Every AI prompt in StorePilot must be registered with version metadata before use in the foundation pipeline.

## Prompt definition schema

```typescript
type FoundationPromptDefinition = {
  id: string;           // e.g. "ExecutiveBriefing"
  version: string;      // e.g. "v1", "v2", "v3"
  author: string;
  description: string;
  body: string;         // Template with {{variable}} placeholders
  inputSchema: string;
  outputSchema: string;
  temperature: number;
  defaultTier: FoundationModelTier;
  createdAt: string;
};
```

## Storage backends

| Backend                 | Use case                          |
|-------------------------|-----------------------------------|
| `InMemoryPromptRegistry`| Tests, bootstrap                  |
| `FileBackedPromptRegistry` | Production — loads `app/ai/prompts/*.md` |

File-backed registry uses existing `parsePromptFile` from `app/ai/prompts/prompt-loader.ts`.

## Versioning rules

1. **Never mutate a published version** — create `v2`, `v3`, etc.
2. Callers may pin `promptVersion: "v2"` or omit to receive latest.
3. Prompt hash includes `id + version + body` for cache fingerprinting.
4. Changing a prompt body invalidates cache entries automatically (new hash).

## Template rendering

```typescript
import { renderPromptTemplate } from "~/ai/foundation/prompt-registry/registry";

const rendered = renderPromptTemplate(
  "Summarize {{metricName}} for store {{storeId}}.",
  { metricName: "conversion_rate", storeId: "abc" },
);
```

Variables are sanitized for PII before rendering in the pipeline.

## Registering prompts

### In tests

```typescript
const registry = new InMemoryPromptRegistry();
registry.register({
  id: "ExecutiveBriefing",
  version: "v1",
  author: "platform-team",
  description: "Daily executive briefing",
  body: "...",
  inputSchema: "ExecutiveBriefingInput",
  outputSchema: "ExecutiveBriefingOutput",
  temperature: 0.2,
  defaultTier: "standard",
  createdAt: new Date().toISOString(),
});
```

### From markdown files

Place `ExecutiveBriefing.md` under `app/ai/prompts/` with standard frontmatter (id, version, description, expectedSchema). `createDefaultPromptRegistry()` loads on first access.

## Pipeline integration

```typescript
await client.execute({
  promptId: "ExecutiveBriefing",
  promptVersion: "v2", // optional
  variables: { revenueDelta: 0.12 },
  // ...
});
```

Missing prompts throw `AIPlatformError` with code `prompt_not_found`.

## Sprint 2 guidance

- Add new prompts as versioned markdown files before building agents.
- Keep output schema names aligned with Zod schemas in `app/ai/schemas/`.
- Document author and description for audit trails.
