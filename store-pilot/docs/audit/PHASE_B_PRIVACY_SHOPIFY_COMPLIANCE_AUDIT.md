# Phase B - Privacy & Shopify Compliance Audit

Date: 2026-07-10

Scope: Current Prisma schema and current Shopify ingestion/webhook code paths in the local workspace.

Objective: StorePilot should primarily persist operational metrics, normalized business evidence, graph relationships, business memory, predictions, and experiments. It should not persist customer PII such as customer names, email addresses, phone numbers, shipping/billing addresses, payment information, payment methods, IP addresses, or order notes.

## Executive Summary

StorePilot is mostly aligned with a privacy-first architecture. The core commerce tables (`Order`, `OrderLineItem`, `Product`) store business-operational facts: Shopify IDs, timestamps, statuses, totals, product/variant identifiers, SKU/title, quantities, and prices. The primary order sync and knowledge ingestion GraphQL queries do not request customer profile fields, shipping/billing addresses, payment methods, IP addresses, or order notes.

The main privacy/compliance risks are not in the core order sync. They are:

1. Merchant/admin personal data and secrets are persisted in `User`, `Session`, `Store`, `GoogleIntegration`, and `MicrosoftClarityIntegration`. Current code encrypts the token fields; legacy/plaintext-data migration and environment enforcement should still be verified.
2. `CustomerDataExport` intentionally stores a per-customer GDPR export payload and `shopifyCustomerId`; this should be short-lived and aggressively expired.
3. Large JSON columns across AI, evidence, memory, prediction, experiment, and graph tables can become accidental PII sinks unless every writer is guarded.
4. Product and order line item text (`Product.title`, `Product.sku`, `OrderLineItem.title`, `OrderLineItem.sku`) is not customer PII by design, but merchant-entered free text can contain accidental personal data.
5. `redactCustomerOrders` zeros financial amounts and redacts titles for requested orders. This is conservative for privacy, but can corrupt operational metrics unless redacted rows are excluded or flagged.

## Shopify API Verification

### Current scopes

Configured in `shopify.app.toml` and `.env.example`:

- `read_products`
- `read_inventory`
- `write_products`
- `read_orders`

Explicitly prohibited in code:

- `read_customers`
- `write_customers`
- `read_customer_events`
- `write_customer_events`
- `read_marketing_events`
- `write_marketing_events`

Assessment: Good. The app is not asking for customer profile scopes.

### Order sync query posture

The primary order sync types and persistence path in `app/services/orders.server.ts` include:

- Order: ID, name, created/updated/processed/cancelled timestamps, financial status, currency, subtotal/tax/discount/total/refund totals, test flag, paid flag.
- Line item: ID, product ID, variant ID, SKU, title, quantity, unit prices, gift card flag.

No persisted fields for customer name, customer email, phone, address, payment method, payment card data, IP address, or order notes were found in the order schema or normalization types.

### Knowledge ingestion order query posture

`app/knowledge/collector/shopify-collector.ts` order query requests:

- Order ID/name/timestamps/status/totals/refund/test flag.
- Line item variant IDs.

It does not request customer profile, shipping/billing address, payment, IP, or order notes.

## Table-by-Table Inventory

Legend:

- Required: Yes = required for product operation. No = remove or avoid. Conditional = only required for enabled feature/integration.
- Reconstructable: Yes = can be rebuilt from Shopify, integrations, or derived jobs. Partial = can be partly rebuilt but may lose history/decisions.
- Temporary: Yes = should have TTL or be deleted after lifecycle. No = durable business memory/config.
- Customer data: Data about shoppers/customers. Merchant data: Data about store owner/admin or store business.
- Personal data: Natural-person data or credentials/secrets.
- Minimization: OK, Watch, or Violation.

| Table | Why exists | Required | Reconstructable | Temporary | Customer data | Personal data | Minimization |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Store | Store identity, configuration, Shopify token, sync cursors | Yes | Partial | No | No | Secret token; merchant business identity | Watch: token must stay encrypted |
| User | Merchant/admin owner record | Conditional | Yes from Shopify admin/shop | No | No | Merchant email/name | Watch: personal data, keep owner-only |
| Session | Shopify OAuth session storage | Yes | Yes by reauth | Yes | No | Merchant/admin session, token, email/name | Watch: delete on uninstall/expiry |
| Product | Product/variant operational catalog | Yes | Yes from Shopify | No | No | No direct PII | OK; watch merchant free text |
| WebhookEvent | Idempotency and webhook processing state | Yes | No | Yes | No | No | OK; TTL recommended |
| Order | Operational order metrics | Yes | Yes from Shopify while accessible | No | Yes, order-linked operational data | No direct PII in schema | Watch: orderName can identify an order |
| OrderLineItem | Order/product velocity and revenue facts | Yes | Yes from Shopify while accessible | No | Yes, order-linked items | No direct PII | Watch: SKU/title can contain accidental PII |
| SyncJob | Async job queue | Yes | No | Yes | No, unless payload polluted | No, unless payload polluted | Watch: guard JSON payload |
| WorkerInstance | Worker heartbeat and runtime state | Yes | Yes | Yes | No | Hostname may identify infra | OK |
| StoreOnboarding | Onboarding state machine | Yes | Partial | No | No | No | OK |
| JobEvent | Job audit trail | Yes | Partial | Yes | No, unless metadata polluted | No, unless metadata polluted | Watch: guard metadataJson/message |
| Plan | Billing plan metadata | Yes | Yes from seed/config | No | No | No | OK |
| Subscription | Store subscription state | Yes | Yes from billing provider | No | No | No | OK |
| UsageRecord | Monthly usage limits | Yes | Partial from data | No | No | No | OK |
| GoogleIntegration | Google account and token for GA/GSC/PageSpeed | Conditional | Yes by reconnect | No | No | Merchant email and OAuth tokens | Watch: encrypt tokens, minimize email |
| MicrosoftClarityIntegration | Clarity project and API token | Conditional | Yes by reconnect | No | No | Secret token; project metadata | Watch: encrypt token |
| CustomerDataExport | GDPR customer data request artifact | Conditional | Yes from current stored data | Yes | Yes, keyed by customer ID | Customer identifier | Watch: must TTL/delete after delivery |
| AiPromptVersion | Prompt registry versioning | Yes | Yes from repo/config | No | No | No | OK |
| AiAgentRun | AI execution trace/context | Yes | Partial | Yes/No by retention | No intended | Possible if context polluted | Watch: JSON guard required |
| AiAgentResult | AI output | Yes | Partial | Yes/No by retention | No intended | Possible if result polluted | Watch: JSON guard required |
| AiExecutionTelemetry | Cost/performance metrics | Yes | Partial | No | No | No | OK |
| AiRecommendation | Business recommendations | Yes | Partial | No | No intended | Possible in payloadJson | Watch: JSON guard required |
| AiMemoryRecord | AI memory facts/preferences | Yes | Partial | No/TTL optional | No intended | Possible in payloadJson | Watch: JSON guard required |
| AiResultCacheEntry | Cached AI result lookup | Yes | Yes | Yes | No | No | OK |
| AiCostLedger | AI cost ledger | Yes | Partial | No | No | No | OK |
| AiMerchantBudget | Merchant AI budget config | Yes | Yes | No | No | No | OK |
| Evidence | Normalized business evidence | Yes | Partial/Yes from sources | No | No intended | Possible in value JSON | Watch: enforce PII-free facts |
| EvidenceHistory | Evidence change history | Conditional | Partial | Yes/retention | No intended | Possible in snapshot JSON | Watch: inherits Evidence risk |
| EvidenceSource | Evidence source registry | Yes | Yes | No | No | No | OK |
| EvidenceRelationship | Relationships between facts | Yes | Yes | No | No | No | OK |
| EvidenceObservation | Point-in-time evidence observations | Yes | Partial | Retention recommended | No intended | Possible in value JSON | Watch: enforce PII-free values |
| KnowledgeSyncCheckpoint | Knowledge ingestion cursors | Yes | Yes by restart | Yes | No | No | OK |
| KnowledgeReadiness | Readiness percentages | Yes | Yes | No | No | No | OK |
| StoreLearningProfile | Store-size/complexity profile | Yes | Yes | No | No | No | OK |
| LearningReadiness | Learning readiness scores | Yes | Yes | No | No | No | OK |
| LearningVelocity | Domain learning velocity | Yes | Yes | No | No | No | OK |
| LearningEta | Estimated learning completion | Yes | Yes | No | No | No | OK |
| LearningPriority | Domain priorities | Yes | Yes | No | No | No | OK |
| HistoricalMemory | Durable business memory | Yes | Partial | No | No intended | Possible in memoryJson | Watch: JSON guard required |
| HistoricalSnapshot | Snapshot of memory/baselines/patterns | Yes | Partial | No | No intended | Possible in snapshots | Watch: retention and PII scan |
| PatternSeed | Business pattern seed | Yes | Partial | No | No intended | Possible in patternJson | Watch: JSON guard required |
| ConfidenceSeed | Confidence by domain | Yes | Yes | No | No | No | OK |
| MerchantBaseline | Baseline business metrics | Yes | Partial | No | No intended | Possible in baselineJson | Watch |
| BusinessDnaVersion | Versioned business DNA | Yes | Partial | No | No intended | Possible in dnaJson | Watch |
| QuickWin | Generated quick wins | Yes | Partial | No | No intended | Possible in metadata | Watch |
| QuickWinSummary | Quick win aggregate summary | Yes | Yes | No | No | No | OK |
| ExecutiveDecision | Executive decision recommendations | Yes | Partial | No | No intended | Possible in JSON refs/context | Watch |
| DecisionTask | Tasks for decisions | Yes | Partial | No | No intended | Possible in outcomeJson | Watch |
| DecisionHistory | Decision change snapshots | Conditional | Partial | Retention recommended | No intended | Possible in snapshot | Watch |
| ExecutiveBriefing | Daily/periodic briefing | Yes | Partial | No/retention optional | No intended | Possible in briefingJson | Watch |
| DailyOperatingPlan | Operating plan tasks/summary | Yes | Partial | No/retention optional | No intended | Possible in planJson | Watch |
| OperationalReadiness | Readiness scorecard | Yes | Yes | No | No | No | OK |
| DecisionScore | Decision scoring details | Yes | Yes | No | No intended | Possible in scoreJson | Watch |
| BusinessContextSnapshot | Context used for decisions | Yes | Partial | Retention recommended | No intended | Possible in contextJson | Watch: high-risk JSON sink |
| RootCause | Root cause analysis | Yes | Partial | No | No intended | Possible in JSON fields | Watch |
| CausalChain | Root-cause causal chain | Yes | Partial | No | No intended | Possible in chainJson | Watch |
| CausalTimeline | Causal timeline | Yes | Partial | No | No intended | Possible in eventsJson | Watch |
| SignalCorrelation | Correlations among business signals | Yes | Yes | No | No intended | Possible in correlationJson | Watch |
| CauseConfidence | Root cause confidence components | Yes | Yes | No | No | No | OK |
| ImpactAssessment | Business impact scoring | Yes | Yes | No | No direct customer PII | No | OK; `customerImpact` is aggregate score |
| CausalGraphEdge | Causal relationship edge | Yes | Partial | No | No intended | Possible in edgeJson | Watch |
| RootCauseHistory | Root cause snapshots | Conditional | Partial | Retention recommended | No intended | Possible in snapshot | Watch |
| Prediction | Forecast/prediction records | Yes | Partial | No | No intended | Possible in JSON support fields | Watch |
| PredictionHistory | Prediction snapshots | Conditional | Partial | Retention recommended | No intended | Possible in snapshot | Watch |
| PredictionConfidence | Confidence details | Yes | Yes | No | No | No | OK |
| ForecastModel | Forecast model state | Yes | Partial | No | No intended | Possible in modelJson | Watch |
| ForecastSnapshot | Forecast outputs | Yes | Partial | No | No intended | Possible in snapshotJson | Watch |
| PreventionAction | Recommended preventive actions | Yes | Partial | No | No intended | Possible in text/JSON refs | Watch |
| RiskAssessment | Risk scoring | Yes | Yes | No | No intended | Possible in riskJson | Watch |
| ForecastAccuracy | Prediction accuracy tracking | Yes | Partial | No | No | No | OK |
| BusinessStability | Business stability score | Yes | Yes | No | No | No | OK |
| Experiment | Experiment plan | Yes | Partial | No | No intended | Possible in JSON metrics/refs | Watch |
| ExperimentTemplate | Experiment templates | Yes | Yes from code/seed | No | No | No | OK |
| ExperimentOpportunity | Experiment opportunities | Yes | Partial | No | No intended | Possible in opportunityJson | Watch |
| ExperimentRecommendation | Recommendation for experiment | Yes | Partial | No | No | No | OK |
| ExperimentBaseline | Experiment baseline metrics | Yes | Partial | No | No intended | Possible in baselineJson | Watch |
| ExperimentVariant | Experiment variant values | Yes | Partial | No | No intended | Possible in current/proposed text | Watch |
| ExperimentObservation | Experiment observed metrics | Yes | Partial | No | No intended | Possible in observationJson | Watch |
| ExperimentResult | Experiment result metrics | Yes | Partial | No | No intended | Possible in resultJson | Watch |
| ExperimentWinner | Winner selection | Yes | Partial | No | No intended | Possible in winnerJson | Watch |
| ExperimentHistory | Experiment snapshots | Conditional | Partial | Retention recommended | No intended | Possible in snapshot | Watch |
| ExperimentLearning | Learning emitted from experiments | Yes | Partial | No | No intended | Possible in eventJson | Watch |
| ExperimentConfidence | Experiment confidence details | Yes | Yes | No | No | No | OK |
| DecisionJournal | Merchant decisions/outcomes | Yes | Partial | No | No intended | Merchant behavior data | Watch: merchant personal/profiling data |
| MerchantDecision | Merchant action record | Yes | Partial | No | No | Merchant behavior data | Watch |
| MerchantFeedback | Merchant feedback text | Conditional | No | Retention recommended | No | Merchant-authored personal data possible | Watch: free text PII risk |
| AdaptiveMemory | Adaptive business memory | Yes | Partial | No | No intended | Possible in memoryJson | Watch |
| RecommendationOutcome | Outcome tracking | Yes | Partial | No | No | No | OK |
| PredictionAccuracyRecord | Prediction accuracy audit | Yes | Partial | No | No | No | OK |
| PredictionValidation | Prediction validation | Yes | Partial | No | No | Merchant behavior data | Watch |
| RootCauseValidation | Root cause validation | Yes | Partial | No | No | Merchant behavior data | Watch |
| MerchantPreference | Merchant preference model | Yes | Partial | No | No | Merchant profiling data | Watch |
| MerchantBehaviorProfile | Merchant behavior profile | Yes | Partial | No | No | Merchant profiling data | Watch |
| PersonalizationProfile | UI/recommendation personalization | Yes | Partial | No | No | Merchant profiling data | Watch |
| AdaptiveConfidence | Adaptive confidence scoring | Yes | Yes | No | No | No | OK |
| AdaptiveScore | Overall adaptive maturity score | Yes | Yes | No | No | Merchant behavior aggregate | OK/Watch |
| DecisionTimeline | Decision timeline events | Yes | Partial | No | No intended | Possible in eventJson | Watch |
| MerchantTimeline | Merchant timeline events | Yes | Partial | No | No intended | Possible in eventJson/title | Watch |
| BusinessMemoryVersion | Versioned durable memory | Yes | Partial | No | No intended | Possible in memoryJson | Watch |
| LearningHistory | Learning update snapshots | Yes | Partial | Retention recommended | No intended | Possible in snapshot | Watch |
| LearningSnapshot | Learning checkpoint snapshots | Yes | Partial | Retention recommended | No intended | Possible in checkpointJson | Watch |
| LearningAttribution | Attribution from action to learning | Yes | Partial | No | No intended | Possible in attributionJson | Watch |
| KnowledgeGraphNode | Business graph nodes | Yes | Yes/Partial | No | No intended | Possible in displayName/metadata | Watch |
| KnowledgeGraphEdge | Business graph edges | Yes | Yes | No | No | No | OK |
| KnowledgeGraphRelationship | Semantic graph relationships | Yes | Yes | No | No | No | OK |
| KnowledgeGraphVersion | Graph version metadata | Yes | Yes | No | No | No | OK |
| KnowledgeGraphSnapshot | Full graph snapshots | Conditional | Yes/Partial | Retention recommended | No intended | Possible in snapshots | Watch |
| KnowledgeGraphMetadata | Graph build state | Yes | Yes | No | No | No | OK |
| KnowledgeGraphIntegrity | Graph integrity report | Yes | Yes | No | No | No | OK |
| KnowledgeGraphStatistics | Graph aggregate metrics | Yes | Yes | No | No | No | OK |
| KnowledgeGraphSearchIndex | Search text/tags for graph | Yes | Yes | No | No intended | Possible if graph node text polluted | Watch |
| KnowledgeGraphBuildCheckpoint | Graph build checkpoint | Yes | Yes | Yes | No | No | OK |

## Specific PII Verification

### Not found as persisted schema fields

No Prisma fields were found for:

- Customer names
- Customer email addresses
- Customer phone numbers
- Shipping addresses
- Billing addresses
- Payment information
- Payment methods
- IP addresses
- Order notes

### Fields that can still carry sensitive data

- `Session.email`, `Session.firstName`, `Session.lastName`: merchant/admin session profile, not shopper PII.
- `User.email`, `User.name`: merchant/admin owner data.
- `GoogleIntegration.email`: merchant Google account email.
- `Store.accessToken`, `GoogleIntegration.refreshToken`, `GoogleIntegration.accessToken`, `MicrosoftClarityIntegration.apiToken`, `Session.accessToken`, `Session.refreshToken`: secrets, not PII, but high-sensitivity.
- `CustomerDataExport.shopifyCustomerId` and `exportPayload`: shopper/customer data for GDPR fulfillment.
- JSON fields across AI/evidence/graph/memory domains: no static schema guarantee; must be guarded at every writer.

## Data Minimization Assessment

### Aligned with target

- Core order sync stores metrics and line-item facts, not shopper identities.
- Knowledge order collector excludes customer PII fields.
- Shopify scopes exclude customer scopes.
- `privacy-by-architecture` helper defines prohibited PII field names and scopes.
- GDPR logs hash `shopifyCustomerId`.
- GDPR export says StorePilot does not store customer email/phone/name.

### Needs remediation

1. ~~Add TTL to `CustomerDataExport`.~~ **Done** — `expiresAt` + purge in `runCleanupJobsCron`.
2. ~~Enforce encrypted token storage operationally.~~ **Done** — startup round-trip check, `migratePlaintextSecretTokens` on worker start + daily cron.
3. ~~Add database-level or service-level PII guards for JSON writes.~~ **Done** — `assertJsonPayloadFreeOfCustomerPii` wired to Evidence, AI, graph, historical, merchant-intelligence writers.
4. ~~Revisit customer redaction strategy.~~ **Done** — `privacyRedacted` flag; metrics exclude redacted orders; financial amounts preserved; upserts blocked.
5. ~~Minimize merchant/admin PII.~~ **Done** — session firstName/lastName stripped; `User.name` uses shop alias.
6. ~~Apply retention to operational logs and events.~~ **Done** — see `app/lib/privacy-retention.ts` and `docs/audit/DATA_CLASSIFICATION.md`.

### Governance (P2)

1. ~~Scheduled JSON PII scan~~ — `privacy-pii-scan` cron daily.
2. ~~Schema documentation tags~~ — `docs/audit/DATA_CLASSIFICATION.md` + Prisma comments on key models.
3. ~~Scope drift monitoring~~ — startup check + `scope-drift-monitor` cron.

## Prioritized Remediation Plan

### P0 - Compliance blockers before scale

1. Add `expiresAt` and purge job for `CustomerDataExport`.
2. Enforce token encryption key presence in production and migrate/audit any token rows missing the `spenc:v1:` prefix.
3. Add PII guardrail wrappers for all JSON persistence surfaces.
4. Add tests that fail if order GraphQL queries include customer/address/payment/IP/note fields.

### P1 - Privacy-first hardening

1. Add JSON PII scan before writes to AI context/results, evidence, business memory, graph nodes/snapshots, merchant feedback, and timelines.
2. Add retention policy table/documentation for every temporary/audit table.
3. Add redaction-safe metric strategy for customer redact webhooks.
4. Replace merchant names with derived display values where possible.

### P2 - Operational governance

1. Add a scheduled privacy audit that scans JSON payloads for prohibited keys/patterns.
2. Add schema comments or docs tags for customer data, merchant personal data, secrets, and retention.
3. Add an allowlist for Shopify GraphQL fields used by ingestion.
4. Add monitoring alert when configured Shopify scopes include prohibited customer scopes.

## Bottom Line

StorePilot is not behaving like a CRM and does not persist shopper PII in the core order/product/knowledge ingestion paths. The architecture is directionally correct for privacy-first Shopify compliance.

The highest leverage improvement is to treat every JSON field as untrusted until proven PII-free, and to make GDPR export artifacts temporary. The next highest leverage improvement is verifying token encryption for every integration/session token column.
