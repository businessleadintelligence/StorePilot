# Logging Audit — StorePilot Phase A

**Date:** 2026-07-10

---

## Logging Infrastructure

| Component | Path | Format |
|-----------|------|--------|
| Structured logging | `app/lib/logging/format.server.ts` | JSON |
| Log levels | debug/info/warn/error/fatal | Configurable via `LOG_LEVEL` |
| Context redaction | `app/lib/logging/redaction.server.ts` | PII stripped |
| Privacy log sanitization | `app/lib/privacy-by-architecture.ts` | Customer ID hashing |
| DB query logging | `packages/database/client.ts` | Optional `PRISMA_LOG_QUERIES=1` |
| Worker logging | `worker-runtime.server.ts`, `worker.server.ts` | Console structured |
| Shopify after-auth | `app/shopify.server.ts` | Console with prefix |

---

## Log Level Behavior

- Production default: `info` (via `resolveMinimumLogLevel()`)
- Development default: `debug`
- Prisma: `error` + `warn` always; query events optional

---

## Sensitive Information

| Control | Status |
|---------|--------|
| Log context redaction | ✅ `redactLogContext()` |
| GDPR customer ID hashing | ✅ `sanitizeLogContext()` |
| Access tokens in logs | Not observed in structured logs — verify ad-hoc console calls |
| AI prompt content logging | Foundation PII sanitizer — V2 path less guarded |

---

## Correlation IDs

**Gap:** No request correlation ID propagated from HTTP → worker → AI pipeline observed in code review.

**Recommendation:** Add `x-request-id` middleware and include in all structured log entries.

---

## Consistency Gaps

| Issue | Files |
|-------|-------|
| Mix of structured JSON and plain console | `shopify.server.ts`, some worker paths |
| No centralized logger instance | Each module logs independently |
| Worker logs not aggregated to external service | Ops dependency on container logs |

---

## Recommendations

| Priority | Action | Effort |
|----------|--------|--------|
| 🟠 High | Add correlation ID middleware | 1-2 days |
| 🟠 High | Replace ad-hoc console with structured logger | 3-5 days |
| 🟡 Medium | Wire logs to external aggregator (Axiom/Datadog) | 2-3 days |
| 🟡 Medium | Audit V2 AI logs for prompt/PII leakage | 1-2 days |

---

## Score: 80/100

Good foundation with redaction. Missing correlation IDs and external aggregation.
