# Error Handling Audit — StorePilot Phase A

**Date:** 2026-07-10

---

## Typed Error Classes (Present)

| Error | File | Domain |
|-------|------|--------|
| `AIPlatformError` | `app/ai/core/ai-errors.ts` | AI with typed codes |
| `JobWorkerOwnershipError` | `app/services/job.server.ts` | Worker lock conflicts |
| `JobHeartbeatError` | `app/services/worker.server.ts` | Lock lost mid-execution |
| `WebhookLeaseOwnershipError` | `app/services/webhook.server.ts` | Webhook dedup |
| `CustomerDataExportScopeError` | `app/services/gdpr.server.ts` | GDPR export validation |
| `StoreUpsertError` | `app/services/store.server.ts` | Store creation |
| `OnboardingPhaseStartError` | `app/services/onboarding.server.ts` | Onboarding |
| `BootstrapSubscriptionError` | `app/services/billing.server.ts` | Billing |
| `TokenEncryptionKeyMissingError` | `app/services/token-crypto.server.ts` | Crypto |
| `ShopifyExecutionError` | `app/shopify-automation/shopify-errors.ts` | Automation |
| `ConnectorError` | `app/connectors/core/connector-errors.ts` | Connectors |
| `GoogleApiError` / `ClarityApiError` | Integration modules | External APIs |
| `EvidenceValidationError` | `app/knowledge/validators/evidence-validator.ts` | Knowledge |
| `BillingEnforcementError` | `app/billing/billing-engine.ts` | Billing |

**Assessment:** Good typed error coverage in critical paths. Not universal across all services.

---

## Error Classification Matrix

| Category | Handling | Example |
|----------|----------|---------|
| Retryable infra | Exponential backoff in job queue | Worker job failure |
| Retryable AI | Foundation retry engine + circuit breaker | Provider timeout (Foundation only) |
| Fatal config | Throw on startup | Missing `TOKEN_ENCRYPTION_KEY` |
| User errors | JSON response with error code | Experiment action missing ID |
| Graceful degradation | Deterministic fallbacks when AI disabled | COO without GPT |
| Silent swallow | ⚠️ `catch(() => undefined)` on pipeline chain | worker.server.ts |

---

## Route Error Boundaries

Intelligence workspace routes export `ErrorBoundary` using Shopify `boundary.error()`.

**Coverage:** All `app.*.tsx` intelligence routes + legacy routes.

---

## Gaps

| Gap | Impact | Recommendation |
|-----|--------|----------------|
| No unified error taxonomy document | Inconsistent error codes across modules | Create `app/lib/errors.ts` registry |
| V2 AI errors not classified retryable vs fatal uniformly | Wasted retries | Align with Foundation error types |
| Pipeline chain silent failures | Missing intelligence data | Log + alert + dead-letter for chain steps |
| Some services throw raw `Error("missing_shop")` | Harder to handle programmatically | Use typed errors |
| No global error monitoring integration | Ops blind spot | Wire to Sentry/Datadog |

---

## Graceful Degradation (Strengths)

- Deterministic engines produce output without AI
- `AI_PLATFORM_ENABLED` gate on Foundation COO and explanations
- Dashboard shows empty states when intelligence not yet generated
- Worker ownership conflict repair for onboarding (`repairOwnershipConflictOnboarding`)

---

## Score: 85/100

Solid typed errors in core infrastructure. Deductions for silent pipeline failures and incomplete AI error unification.
