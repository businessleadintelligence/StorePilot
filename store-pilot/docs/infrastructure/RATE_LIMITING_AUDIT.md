# Rate Limiting Audit

## Current State

StorePilot has HTTP retry helpers, Shopify GraphQL retry behavior, and an in-process per-store Shopify automation queue. AI provider retry/circuit-breaker patterns exist in the Foundation layer. No shared distributed rate limiter was found.

## Strengths

- Shopify automation serializes operations per store within one process.
- HTTP retry supports retryable status codes and `Retry-After`.
- AI Foundation has retry and circuit breaker concepts.
- Billing/AI credits limit merchant usage at the plan level.

## Weaknesses

- In-process queues do not protect across Vercel instances, Railway replicas, or multiple workers.
- No global, per-IP, per-user, per-store, or per-route token bucket for dashboard/API endpoints was found.
- No adaptive throttling for Shopify, OpenAI, Anthropic, Google, or Microsoft across all code paths.
- No merchant isolation policy for expensive graph, prediction, search, experiments, or command center endpoints.
- Webhook endpoint rate limiting is not evident beyond Shopify validation/idempotency.

## Risk Level

High at scale.

## Recommendations

- Add Redis/Upstash or database-backed distributed rate limits.
- Enforce limits by store, user, IP, route, provider, and global platform budget.
- Add burst and sustained limits for expensive endpoints.
- Add provider-specific backoff and quota dashboards.
- Add webhook abuse protection that preserves valid Shopify delivery behavior.

## Priority

P1.

## Estimated Engineering Effort

2 to 4 weeks.
