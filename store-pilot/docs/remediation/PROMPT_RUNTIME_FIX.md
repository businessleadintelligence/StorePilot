# Prompt Runtime Fix — Phase C.2

## Problem

Local: `validateFoundationPromptRegistry()` → ok  
Production `/health/ready` → **13 prompts missing**

Root cause: Vercel serverless bundle does not include `app/ai/prompts/*.md` at expected filesystem paths.

## Fixes

### 1. Build-time copy (`scripts/copy-vercel-prompts.mjs`)

After `react-router build`, copies prompts to:

- `build/server/app/ai/prompts/` (flat)
- `build/server/{hash}/app/ai/prompts/` (per-route bundles)

### 2. Runtime resolution (`prompt-registry/store.ts`)

`resolveDefaultPromptsDirectory()` tries candidates in order:

1. `{cwd}/app/ai/prompts`
2. `{cwd}/build/server/app/ai/prompts`
3. `{cwd}/store-pilot/app/ai/prompts`
4. Each subdirectory under `build/server/*/app/ai/prompts`

First readable directory wins.

### 3. Scope drift (related readiness failure)

`app/lib/shopify-app-config.ts` — embedded scopes when `shopify.app.toml` absent on serverless.

## Verification

### Local

```bash
npm run build
node -e "import('./app/ai/foundation/prompt-validation.server.ts').then(m => console.log(m.validateFoundationPromptRegistry()))"
```

### Production (after deploy)

```bash
curl https://store-pilot-eta.vercel.app/health/ready
```

**Pass:** `foundation_prompt_registry` check ok, no `missing_prompts:*`

## Files Changed

- `scripts/copy-vercel-prompts.mjs`
- `app/ai/foundation/prompt-registry/store.ts`
- `app/lib/shopify-app-config.ts`
- `app/services/scope-drift-monitor.server.ts`
