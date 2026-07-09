# StorePilot — Logging Architecture

**Sprint:** 5 — Logging Platform  
**Date:** 2026-07-09  
**Scope:** Production structured logging infrastructure (`app/lib/logging/`)

---

## Executive summary

StorePilot production logging is built on **single-line JSON** records emitted to stdout/stderr. Vercel, Datadog, Axiom, and similar platforms ingest these lines without additional application code.

| Capability | Status |
|------------|--------|
| Structured JSON | Implemented |
| Correlation IDs | Implemented (`AsyncLocalStorage`) |
| Shopify Request IDs | Implemented (header extraction + child loggers) |
| Worker / Cron / Webhook IDs | Implemented |
| AI Request IDs | Implemented |
| Database (Supabase/Postgres) Request IDs | Implemented |
| Levels: debug → fatal | Implemented |
| PII redaction | Implemented (keys + value patterns) |

**Infrastructure only.** Existing `console.*` calls in worker, onboarding, and Shopify auth flows are unchanged. New code and gradual migration should use `createLogger()` or `createSafeLogger()`.

---

## Design principles

1. **One JSON object per line** — no multi-line blobs; compatible with log drains.
2. **Correlation over prefixes** — bracket prefixes (`[worker]`) are deprecated; `component` field replaces them.
3. **Secrets never logged** — sensitive key names and PII patterns are redacted before emit.
4. **Request-scoped context** — `AsyncLocalStorage` propagates IDs through async call chains without parameter threading.
5. **Opt-in verbosity** — `LOG_LEVEL` controls noise; production defaults to `info`.

---

## Log record schema

Every log line is a JSON object with these fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `timestamp` | ISO-8601 string | Yes | UTC emit time |
| `level` | `debug\|info\|warn\|error\|fatal` | Yes | Severity |
| `service` | string | Yes | Always `store-pilot` |
| `component` | string | Yes | Subsystem (e.g. `webhook-event`, `worker`, `ai-platform`) |
| `message` | string | Yes | Human-readable summary |
| `environment` | string | Yes | `NODE_ENV` value |
| `correlationId` | string | No | End-to-end trace ID |
| `shopifyRequestId` | string | No | Shopify Admin API / platform request ID |
| `workerId` | string | No | Background worker cycle ID |
| `cronId` | string | No | Cron invocation ID |
| `webhookId` | string | No | Shopify webhook delivery ID |
| `aiRequestId` | string | No | AI platform execution ID |
| `databaseRequestId` | string | No | Database operation correlation ID |
| `...` | any | No | Additional structured context (redacted) |

### Example — webhook processing

```json
{
  "timestamp": "2026-07-09T07:15:32.481Z",
  "level": "info",
  "service": "store-pilot",
  "component": "webhook-event",
  "message": "webhook processed",
  "environment": "production",
  "correlationId": "corr-8f2a1c4e-...",
  "shopifyRequestId": "e7a1b2c3-...",
  "webhookId": "wh-123456789",
  "shop": "demo.myshopify.com",
  "topic": "products/update",
  "operation": "webhook_processed"
}
```

### Example — AI execution

```json
{
  "timestamp": "2026-07-09T07:16:01.002Z",
  "level": "info",
  "service": "store-pilot",
  "component": "ai-platform",
  "message": "AI execution completed",
  "environment": "production",
  "aiRequestId": "ai-4c9d-...",
  "agentId": "inventory-intelligence",
  "provider": "openai",
  "model": "gpt-4o-mini",
  "latencyMs": 842,
  "estimatedCostUsd": 0.0012,
  "status": "success",
  "operation": "agent_run_success"
}
```

---

## Log levels

| Level | Rank | When to use | Production default |
|-------|------|-------------|-------------------|
| `debug` | 10 | Verbose diagnostics, payload shapes (never secrets) | Hidden |
| `info` | 20 | Normal operations — syncs, job claims, auth milestones | **Emitted** |
| `warn` | 30 | Recoverable anomalies — retries, skipped work | Emitted |
| `error` | 40 | Failures requiring attention | Emitted |
| `fatal` | 50 | Unrecoverable startup / security failures | Emitted |

### Configuration

| Variable | Default (production) | Default (development) |
|----------|----------------------|---------------------|
| `LOG_LEVEL` | `info` | `debug` |

Set `LOG_LEVEL=warn` in production to reduce volume during incidents.

---

## Correlation ID model

```
HTTP Request
  └─ correlationId (generated or X-Correlation-Id header)
       ├─ shopifyRequestId (X-Shopify-Request-Id / X-Request-Id)
       ├─ webhookId (X-Shopify-Webhook-Id)
       └─ Worker cycle
            ├─ cronId
            └─ workerId
                 ├─ databaseRequestId (per Prisma operation batch)
                 └─ aiRequestId (per LLM call)
```

### ID generators

| Function | Format | Module |
|----------|--------|--------|
| `generateCorrelationId()` | `corr-<uuid>` | `ids.server.ts` |
| `createWorkerId()` | `worker-<uuid>` | `ids.server.ts` |
| `createCronId()` | `cron-<uuid>` | `ids.server.ts` |
| `createWebhookLogId(id?)` | `wh-<id>` or `wh-<uuid>` | `ids.server.ts` |
| `generateAiRequestId()` | `ai-<uuid>` | `ids.server.ts` |
| `generateDatabaseRequestId()` | `db-<uuid>` | `ids.server.ts` |

### Request header mapping

| Header | Log field |
|--------|-----------|
| `X-Correlation-Id` | `correlationId` (passthrough; generated if absent) |
| `X-Shopify-Request-Id` | `shopifyRequestId` |
| `X-Request-Id` | `shopifyRequestId` (GraphQL fallback) |
| `X-Shopify-Webhook-Id` | `webhookId` |

---

## PII and secret redaction

Redaction runs on every emit via `redactLogContext()`:

### Sensitive key names (value → `[redacted]`)

Matches keys containing: `token`, `secret`, `password`, `authorization`, `cookie`, `session`, `api_key`, `apikey`, `refresh`, `access_token`, `oauth`, `code`, `charge_id`, `payment`, `credential`, `hmac`, `signature`.

### PII value patterns

- Email addresses → `[redacted]`
- Phone numbers → `[redacted]`
- `shopifyCustomerId` → `customerIdHash` (SHA-256 truncated, from `privacy-by-architecture.ts`)

### Never log

- Raw LLM prompts or completions
- OAuth codes or refresh tokens
- `CRON_SECRET`, `TOKEN_ENCRYPTION_KEY`, `SHOPIFY_API_SECRET`
- Customer email, phone, or address fields

---

## API reference

### Create a logger

```typescript
import { createLogger } from "~/lib/logging/index.server";

const logger = createLogger({ component: "product-sync" });

logger.info("sync completed", {
  shop: "demo.myshopify.com",
  productCount: 142,
  operation: "product_sync_completed",
});
```

### Request-scoped context

```typescript
import {
  createRequestLogContext,
  runWithLogContext,
  withLogContext,
} from "~/lib/logging/index.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const context = createRequestLogContext(request);

  return runWithLogContext(context, async () => {
    // All logs inside inherit correlationId + shopifyRequestId
    return Response.json({ ok: true });
  });
}
```

### Worker / cron context

```typescript
import { createCronId, createWorkerId, withLogContext } from "~/lib/logging/index.server";

const cronId = createCronId();
const workerId = createWorkerId(Date.now());

withLogContext({ cronId, workerId }, () => {
  logger.info("worker cycle started", { operation: "cron_worker_started" });
});
```

### Child loggers

```typescript
const workerLogger = logger.child({
  workerId: "worker-abc",
  component: "worker",
});
```

### Backward-compatible safe logger

`createSafeLogger("[webhook-event]")` in `app/lib/safe-log.server.ts` now delegates to the structured logger. Existing callers (e.g. `webhook.server.ts`) emit JSON without code changes.

### AI platform logger

`ConsoleAILogger` in `app/ai/core/ai-logger.ts` emits structured JSON with `aiRequestId` per execution.

---

## Module layout

```
app/lib/logging/
  index.server.ts      # Public exports
  types.server.ts      # LogLevel, CorrelationIds, StructuredLogEntry
  ids.server.ts        # ID generators
  context.server.ts    # AsyncLocalStorage + request header extraction
  redaction.server.ts  # PII + sensitive key redaction
  format.server.ts     # JSON line builder + LOG_LEVEL filtering
  logger.server.ts     # createLogger(), rootLogger
  __tests__/
    logging.test.ts    # Infrastructure tests
```

---

## Platform integration

### Vercel

- Logs appear in **Vercel → Project → Logs**.
- JSON lines are automatically parsed by Vercel log drains.
- No SDK required for baseline structured logging.

### Future: external log drain

Forward stdout to Datadog, Axiom, or Better Stack via Vercel log drain integration. Query examples:

```
component:webhook-event level:error
correlationId:"corr-8f2a1c4e-..."
shopifyRequestId:"e7a1b2c3-..."
```

### Database (Supabase / Postgres) correlation

StorePilot uses **Prisma** against Supabase PostgreSQL. There is no Supabase JS client in the runtime path. Use `databaseRequestId` to correlate Prisma operation batches:

```typescript
import { generateDatabaseRequestId, withLogContext } from "~/lib/logging/index.server";

const databaseRequestId = generateDatabaseRequestId();
withLogContext({ databaseRequestId }, async () => {
  await prisma.product.findMany({ where: { storeId } });
});
```

Optional future: Prisma middleware can auto-inject `databaseRequestId` (not implemented in this sprint).

---

## Migration guide (incremental)

| Current pattern | Target pattern |
|-----------------|----------------|
| `console.info(LOG_PREFIX, { message, ... })` | `createLogger({ component: "worker" }).info("message", { ... })` |
| `createSafeLogger("[webhook-event]")` | Already migrated (JSON output) |
| Manual `console.error` in routes | `logger.error()` with `createRequestLogContext(request)` |

**Do not migrate in bulk.** Adopt per-subsystem during feature work to avoid unrelated diffs.

### Recommended wiring order

1. HTTP entry — wrap loaders/actions with `runWithLogContext(createRequestLogContext(request), ...)`
2. Webhooks — already use `createSafeLogger` (JSON enabled)
3. Worker / cron — wrap `runWorkerCycle` with `withLogContext({ workerId, cronId })`
4. AI — `ConsoleAILogger` already structured
5. Prisma batches — add `databaseRequestId` at service boundaries

---

## Testing

```bash
npx vitest run app/lib/logging/__tests__/logging.test.ts
npx vitest run app/ai/tests/ai-logger.test.ts
npx vitest run app/lib/__tests__/production-hardening.test.ts
```

Tests verify JSON shape, level filtering, correlation propagation, header extraction, and redaction.

---

## Environment variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `LOG_LEVEL` | Minimum level to emit | `info` (production), `debug` (development) |
| `NODE_ENV` | Recorded in `environment` field | — |

See [`docs/ENVIRONMENT_VARIABLES.md`](./ENVIRONMENT_VARIABLES.md) for the full env audit.

---

## Files added / changed (Sprint 5)

| File | Change |
|------|--------|
| `app/lib/logging/*` | **Added** — logging platform |
| `app/lib/safe-log.server.ts` | **Updated** — delegates to structured logger |
| `app/ai/core/ai-logger.ts` | **Updated** — structured JSON + `aiRequestId` |
| `app/ai/tests/ai-logger.test.ts` | **Updated** — assert JSON line format |
| `docs/LOGGING_ARCHITECTURE.md` | **Added** — this document |

No worker, webhook, Shopify auth, or route behavior was changed in this sprint.
