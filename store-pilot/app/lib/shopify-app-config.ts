/**
 * Canonical Shopify app scopes — embedded for serverless readiness checks.
 * Keep in sync with shopify.app.toml [access_scopes].scopes
 */
export const SHOPIFY_APP_TOML_SCOPES =
  "read_products,read_inventory,write_products,read_orders" as const;

export const SHOPIFY_APP_TOML_SCOPE_LIST = SHOPIFY_APP_TOML_SCOPES.split(",")
  .map((scope) => scope.trim())
  .filter(Boolean);
