import type { Session } from "@shopify/shopify-api";

const MERCHANT_ALIAS_PREFIX = "Store Owner";

export function deriveMerchantAliasFromShop(shop: string): string {
  const shopLabel = shop
    .replace(/\.myshopify\.com$/i, "")
    .replace(/[-_]/g, " ")
    .trim();

  if (!shopLabel) {
    return MERCHANT_ALIAS_PREFIX;
  }

  return `${MERCHANT_ALIAS_PREFIX} (${shopLabel})`;
}

export function stripMerchantSessionPii(session: Session): Session {
  const sanitized = session as Session & {
    firstName?: string | null;
    lastName?: string | null;
  };

  sanitized.firstName = null;
  sanitized.lastName = null;

  return sanitized;
}

export function resolveMerchantDisplayNameFromShop(shop: string): string {
  const alias = deriveMerchantAliasFromShop(shop);
  const shopLabel = shop.replace(/\.myshopify\.com$/i, "").replace(/[-_]/g, " ");
  return shopLabel || alias;
}
