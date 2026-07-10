# Logging Audit

## Current State

A structured logger exists under `app/lib/logging`, with redaction, async log context, correlation IDs, and tests. Many production paths still use direct `console.info`, `console.warn`, and `console.error` with structured objects.

## Strengths

- Redaction utilities cover sensitive keys and PII-like patterns.
- Correlation ID support exists.
- AI Foundation logger records request IDs and provider metadata.
- Worker, job, webhook, billing, GDPR, and sync paths log operational events.

## Weaknesses

- Logger adoption is inconsistent; direct console usage remains widespread.
- No external log shipping configuration was found.
- Log retention policy is not defined in repo.
- Request ID, worker ID, job ID, store ID, and provider request ID are not guaranteed on every log path.
- Sampling strategy is not defined.
- Some webhook routes log simple strings.

## Risk Level

Medium-High. Debugging is possible locally or in platform logs, but incident reconstruction across systems will be difficult.

## Recommendations

- Standardize on `createLogger` and `runWithLogContext` for all production code paths.
- Require correlation ID, store ID, job ID, worker ID, duration, and operation on structured logs where applicable.
- Ship logs to external aggregation with retention and search.
- Add log sampling for high-volume success events.
- Add tests for sensitive provider tokens and customer PII redaction in logs.

## Priority

P1.

## Estimated Engineering Effort

1 to 2 weeks.
