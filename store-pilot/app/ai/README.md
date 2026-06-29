# StorePilot AI Platform v1.0

Provider-agnostic AI infrastructure for StorePilot agents.

## Principles

- **Privacy-by-Architecture:** Never collect, store, or process customer PII unless mandatory for GDPR compliance. Prefer aggregated business metrics. See `docs/PRIVACY_BY_ARCHITECTURE.md`.
- Business logic, billing, sync, webhooks, and GDPR remain in the existing foundation under `app/services/`.
- All AI execution flows through `app/ai/` and the `AIProvider` interface.
- OpenAI is the only implemented provider, but OpenAI SDK imports are confined to `app/ai/providers/openai/`.
- Prompt wording lives in markdown files under `app/ai/prompts/`.
- Structured outputs are validated with Zod schemas under `app/ai/schemas/`.
- Deterministic calculations stay in StorePilot services; agents receive precomputed facts only.

## Layout

```
app/ai/
  core/           Platform contracts (provider, runner, agent, config, logging)
  providers/      Provider implementations (OpenAI only in v1.0)
  orchestrator/   Operations center + scheduler framework
  prompts/        Externalized markdown prompts
  schemas/        Zod schemas for structured outputs
  memory/         Memory interfaces (no persistence yet)
  agents/         Future agent registration slots
  tests/          Unit tests for the AI platform
```

## Agent pipeline

```
Input
  ↓
collectFacts()          // StorePilot services supply precomputed facts
  ↓
Prompt loader             // Markdown prompt by id/version
  ↓
AIProvider.generateStructured()
  ↓
Zod schema validation
  ↓
validateBusinessRules()
  ↓
Standard AgentRunResult
```

## Configuration

Set environment variables documented in `.env.example` under **AI Platform**.

Never hardcode model names, temperatures, max tokens, or prompt text in TypeScript.

## Adding a new provider

1. Implement `AIProvider` in `app/ai/providers/<provider-id>/`.
2. Register the provider in `app/ai/providers/index.ts`.
3. Set `AI_PROVIDER=<provider-id>` in environment configuration.

No agent or orchestrator changes are required.

## Adding a future agent

1. Create an agent class implementing `AIAgent` (extend `BaseAIAgent`).
2. Inject `AIProvider` through constructor dependencies.
3. Add a markdown prompt file with metadata frontmatter.
4. Register the agent with `OperationsCenter.registerAgent()`.

## Testing

```bash
npm test -- app/ai/tests
```

Tests cover provider abstraction, structured validation, dependency injection, prompt loading, orchestration, logging, and OpenAI error mapping.
