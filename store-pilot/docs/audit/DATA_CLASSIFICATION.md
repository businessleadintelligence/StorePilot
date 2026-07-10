# Data Classification Tags

StorePilot uses schema comments and this document to tag persisted data by privacy class.

## Tags

| Tag | Meaning |
| --- | --- |
| `@privacy customer-data` | Shopper/customer-linked operational data (not profile PII) |
| `@privacy merchant-pii` | Merchant/admin personal data |
| `@privacy operational-metrics` | Business metrics without shopper identity |
| `@secrets` | OAuth/API tokens (encrypted at rest with `spenc:v1:`) |
| `@retention <window>` | Expected TTL or purge policy |

## Retention Windows

Configured in `app/lib/privacy-retention.ts` and enforced by `runCleanupJobsCron`:

| Table | Retention | Cron |
| --- | --- | --- |
| `CustomerDataExport` | 30 days (`expiresAt`) | cleanup-jobs |
| `WebhookEvent` | 30 days | cleanup-jobs |
| `SyncJob` | 14 days (completed/dead_letter) | cleanup-jobs |
| `JobEvent` | 30 days | cleanup-jobs |
| `AiAgentRun` | 90 days | cleanup-jobs |
| `AiAgentResult` | 90 days | cleanup-jobs |
| `EvidenceHistory` | 180 days | cleanup-jobs |
| `EvidenceObservation` | 180 days | cleanup-jobs |
| `AiResultCacheEntry` | 7 days | cleanup-jobs |
| `Session` | Until `expires` | expired-sessions |

## Key Tables

| Table | Customer data | Merchant PII | Secrets | Retention |
| --- | --- | --- | --- | --- |
| `Order` | Order-linked metrics | No | No | Durable; `privacyRedacted` excludes from metrics |
| `OrderLineItem` | Order-linked items | No | No | Durable; redacted line items excluded |
| `CustomerDataExport` | Yes | No | No | 30 days |
| `Session` | No | Email (OAuth) | Tokens | Until expiry |
| `User` | No | Email, alias name | No | Durable |
| `Store` | No | Shop domain | accessToken | Durable |
| `Evidence` / AI JSON | No intended | No | No | Durable; PII guards on write |
| `GoogleIntegration` | No | Email | OAuth tokens | Durable |

## Governance Crons

| Cron | Purpose |
| --- | --- |
| `privacy-pii-scan` | Sample JSON payloads; alert on prohibited PII |
| `scope-drift-monitor` | Alert when env scopes drift from `shopify.app.toml` |
| `token-migration` | Encrypt legacy plaintext tokens |
