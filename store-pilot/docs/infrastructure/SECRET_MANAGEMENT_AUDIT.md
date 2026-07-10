# Secret Management Audit

## Current State

`.env.example` documents Shopify, database, token encryption, cron, worker, Google, AI, Anthropic, billing, and Node variables. Startup readiness validates several required secrets. Token encryption key is required by token crypto. Scripts exist to sync selected env vars to Vercel.

## Strengths

- Required variables are documented.
- Startup readiness checks key secrets: `CRON_SECRET`, `SHOPIFY_API_SECRET`, `SHOPIFY_API_KEY`, `DATABASE_URL`, `TOKEN_ENCRYPTION_KEY`, and Shopify app URL/webhook config.
- `DIRECT_URL` is separated from runtime `DATABASE_URL`.
- Token encryption key is explicitly required for encrypted tokens.
- Cron secret supports bearer/header authentication.

## Weaknesses

- No formal rotation runbook for Shopify, Google, Microsoft, OpenAI, Anthropic, database, cron, or encryption keys.
- No evidence of secret manager integration beyond platform env vars.
- No startup validation for every optional-but-feature-required provider secret.
- No secret age tracking.
- No break-glass process.
- Google OAuth service appears to allow fallback to Shopify API secret for encryption if token key is absent; production should require the dedicated key.

## Risk Level

Medium-High.

## Recommendations

- Classify every secret as required, optional, rotatable, dual-write required, or restart required.
- Add startup readiness checks gated by enabled feature flags.
- Add secret rotation runbook and test quarterly.
- Store secrets only in Vercel/Railway/Supabase secret stores or a dedicated manager.
- Add deploy-time validation for production env completeness.

## Priority

P1.

## Estimated Engineering Effort

1 to 2 weeks.
