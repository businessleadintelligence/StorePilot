export const DEFAULT_KNOWLEDGE_BATCH_SIZE = 50;
export const MAX_KNOWLEDGE_BATCH_SIZE = 250;
export const SHOPIFY_COLLECTOR_PAGE_SIZE = 50;
export const SHOPIFY_RATE_LIMIT_DELAY_MS = 250;
export const SHOPIFY_MAX_RETRIES = 4;
export const SHOPIFY_RETRY_BASE_MS = 500;

export const INVENTORY_LOW_THRESHOLD = 10;
export const INVENTORY_CRITICAL_THRESHOLD = 3;
export const HIGH_INVENTORY_THRESHOLD = 500;
export const DRAFT_TOO_LONG_DAYS = 30;
export const RECENTLY_PUBLISHED_DAYS = 14;
export const LOW_VARIANT_COVERAGE_MIN = 2;
export const LOW_MEDIA_COVERAGE_MIN = 1;

export const READINESS_WEIGHTS = {
  productCatalog: 0.25,
  inventorySignals: 0.25,
  pricingSignals: 0.2,
  orderSignals: 0.2,
  executiveSignals: 0.1,
} as const;

export const BLOCKED_SHOPIFY_FIELDS = new Set([
  "email",
  "phone",
  "address",
  "address1",
  "address2",
  "firstName",
  "lastName",
  "customer",
  "note",
  "paymentDetails",
  "billingAddress",
  "shippingAddress",
]);
