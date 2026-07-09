# Shopify Webhook Compatibility Report

**Date:** 2026-07-09  
**App:** StorePilot (`c2e45ad18cb75c60ff489050150d9bc1`)  
**Audit goal:** Determine why `shopify app deploy` rejected GDPR webhook topics and restore production-compatible configuration.

---

## Executive summary

`shopify app deploy` failed because mandatory GDPR webhooks were declared under the standard `topics` field. Shopify treats `customers/data_request`, `customers/redact`, and `shop/redact` as **compliance topics**, not regular webhook topics. They must be declared with `compliance_topics` in `shopify.app.toml`.

After moving the three GDPR subscriptions from `topics` to `compliance_topics` (keeping the same URIs), deploy succeeded and created app version `storepilot-12`.

**No application logic or OAuth configuration was changed.**

---

## 1. Shopify CLI version

| Item | Value |
|------|-------|
| CLI version | **4.4.0** |
| Node version | v24.16.0 |
| Package manager | pnpm |
| Validation command | `shopify app config validate` |

Verified via `shopify version` and `shopify app info`.

---

## 2. Configured API version

| Location | Value |
|----------|-------|
| `shopify.app.toml` → `[webhooks] api_version` | **2025-10** |
| `app/shopify-api-version.server.ts` | `ApiVersion.October25` / `"2025-10"` |

The webhook API version is consistent across TOML and runtime code. **2025-10 is valid** for operational webhook topics used by StorePilot.

---

## 3. Observed deploy failure (before fix)

Command:

```bash
shopify app deploy --no-release --no-build
```

Result: **Failed** — version could not be created.

```
Version couldn't be created.

  • The following topic is invalid: customers/data_request
  • The following topic is invalid: customers/redact
  • The following topic is invalid: shop/redact
```

Verbose deploy logs showed the CLI sent these as standard webhook subscriptions:

```json
{
  "type": "webhook_subscription",
  "config": {
    "topic": "customers/data_request",
    "api_version": "2025-10",
    "uri": "https://store-pilot-eta.vercel.app/webhooks/customers/data_request"
  }
}
```

The App Management API rejects them because they are not members of the standard webhook topic catalog for `topics`-based subscriptions.

Local `shopify app config validate` **passed** before the fix. Local schema validation does not catch this; only remote deploy validation does.

---

## 4. Shopify requirements for GDPR / compliance webhooks

### Topic names (unchanged)

Shopify mandatory compliance webhook topic names remain:

| Topic | Event |
|-------|-------|
| `customers/data_request` | Merchant/customer request to view stored personal data |
| `customers/redact` | Request to delete customer-linked data |
| `shop/redact` | Request to delete all shop data (48h after uninstall) |

Source: [Privacy law compliance](https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance)

### Configuration block (different from operational webhooks)

Compliance webhooks **must** use `compliance_topics`, not `topics`:

```toml
[[webhooks.subscriptions]]
compliance_topics = ["customers/data_request", "customers/redact", "shop/redact"]
uri = "/webhooks/..."
```

Source: [App configuration — webhooks.subscriptions](https://shopify.dev/docs/apps/build/cli-for-apps/app-configuration)

| Field | Operational webhooks | Compliance (GDPR) webhooks |
|-------|---------------------|----------------------------|
| `topics` | Required for standard topics | **Must not** be used for GDPR topics |
| `compliance_topics` | Not used | **Required** for GDPR topics |
| `uri` | Delivery endpoint | Same — HTTPS URL or relative path |
| API version | Set once under `[webhooks]` | Same `api_version` applies |

### Are GDPR webhooks still declared in `shopify.app.toml`?

**Yes.** They are no longer configured in the Partner Dashboard UI for app-specific (config-managed) webhooks. They are declared in `shopify.app.toml` under `[[webhooks.subscriptions]]` with `compliance_topics`.

The legacy `[webhooks.privacy_compliance]` block is deprecated; the CLI errors if both legacy and `compliance_topics` formats are used together.

### Separate URIs per compliance topic

Supported. Multiple `[[webhooks.subscriptions]]` entries may each define one or more `compliance_topics` with distinct `uri` values, as long as no compliance topic is duplicated across entries.

Reference: [Shopify CLI PR #3392](https://github.com/Shopify/cli/pull/3392), [Shopify subscriptions reference app](https://github.com/Shopify/subscriptions-reference-app/blob/main/shopify.app.toml)

---

## 5. Root cause

**Misclassification in TOML:** GDPR topics were listed under `topics`, which is reserved for standard Admin API webhook topics (e.g. `products/create`, `orders/updated`).

Shopify's deploy pipeline validates `topics` against the standard topic registry. Compliance topics are a separate subscription type registered via `compliance_topics`.

This is **not** an API version issue (`2025-10` is fine). It is **not** a topic rename. The topic strings are correct; only the TOML field name was wrong.

---

## 6. Fix applied

**File changed:** `shopify.app.toml` only.

### Before (rejected by deploy)

```toml
[[webhooks.subscriptions]]
topics = [ "customers/data_request" ]
uri = "/webhooks/customers/data_request"

[[webhooks.subscriptions]]
topics = [ "customers/redact" ]
uri = "/webhooks/customers/redact"

[[webhooks.subscriptions]]
topics = [ "shop/redact" ]
uri = "/webhooks/shop/redact"
```

### After (deploy accepted)

```toml
[[webhooks.subscriptions]]
compliance_topics = [ "customers/data_request" ]
uri = "/webhooks/customers/data_request"

[[webhooks.subscriptions]]
compliance_topics = [ "customers/redact" ]
uri = "/webhooks/customers/redact"

[[webhooks.subscriptions]]
compliance_topics = [ "shop/redact" ]
uri = "/webhooks/shop/redact"
```

### Unchanged

| Section | Status |
|---------|--------|
| `[auth]` redirect URLs | Unchanged |
| `[access_scopes]` | Unchanged |
| Operational webhook topics & URIs | Unchanged |
| Application route handlers | Unchanged (`webhooks.customers.*`, `webhooks.shop.redact`) |
| `application_url`, `client_id`, `embedded` | Unchanged |

---

## 7. Verification

### Local validation

```bash
shopify app config validate
# → App configuration is valid.
```

### Deploy (post-fix)

```bash
shopify app deploy --no-release --no-build
# → success — New version created: storepilot-12
# → https://dev.shopify.com/dashboard/223159805/apps/386433679361/versions/1045119664129
```

No invalid-topic errors. Version `storepilot-12` was created but **not released** (`--no-release`). Run `shopify app release --version=storepilot-12` when ready to push to production merchants.

### Operational webhook inventory (unchanged)

| Topic | URI | Field |
|-------|-----|-------|
| `app/uninstalled` | `/webhooks/app/uninstalled` | `topics` |
| `app/scopes_update` | `/webhooks/app/scopes_update` | `topics` |
| `app_subscriptions/update` | `/webhooks/app/subscriptions/update` | `topics` |
| `products/create` | `/webhooks/products/create` | `topics` |
| `products/update` | `/webhooks/products/update` | `topics` |
| `products/delete` | `/webhooks/products/delete` | `topics` |
| `inventory_levels/update` | `/webhooks/inventory/levels/update` | `topics` |
| `orders/create` | `/webhooks/orders/create` | `topics` |
| `orders/updated` | `/webhooks/orders/updated` | `topics` |
| `orders/cancelled` | `/webhooks/orders/cancelled` | `topics` |
| `customers/data_request` | `/webhooks/customers/data_request` | `compliance_topics` |
| `customers/redact` | `/webhooks/customers/redact` | `compliance_topics` |
| `shop/redact` | `/webhooks/shop/redact` | `compliance_topics` |

---

## 8. Success criteria

| Criterion | Result |
|-----------|--------|
| `shopify app deploy` succeeds | ✅ Version `storepilot-12` created |
| OAuth configuration unchanged | ✅ `[auth]` block untouched |
| Production webhook config matches Shopify requirements | ✅ GDPR via `compliance_topics`; operational via `topics` |
| Application logic unchanged | ✅ No code changes |
| Report generated | ✅ This document |

---

## 9. Next steps

1. **Release to production:** `shopify app release --version=storepilot-12`
2. **Optional:** Trigger test deliveries via Partner Dashboard or `shopify app webhook trigger` for each compliance endpoint.
3. **App Store review:** Confirm mandatory compliance webhooks show as configured in Dev Dashboard after release.

---

## References

- [Privacy law compliance](https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance)
- [App configuration (shopify.app.toml)](https://shopify.dev/docs/apps/build/cli-for-apps/app-configuration)
- [Manage webhook subscriptions](https://shopify.dev/docs/apps/build/webhooks/subscribe)
- [Shopify CLI — compliance_topics support (PR #3392)](https://github.com/Shopify/cli/pull/3392)
