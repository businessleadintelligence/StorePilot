import { ApiVersion } from "@shopify/shopify-api";

/**
 * Canonical Shopify Admin API version for runtime GraphQL, webhook registration,
 * and shopify.app.toml `[webhooks] api_version`.
 */
export const SHOPIFY_ADMIN_API_VERSION = ApiVersion.October25;
export const SHOPIFY_ADMIN_API_VERSION_STRING = "2025-10";
