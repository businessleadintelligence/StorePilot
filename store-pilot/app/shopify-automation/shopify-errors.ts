export type ShopifyErrorCode =
  | "permission_denied"
  | "rate_limited"
  | "network_timeout"
  | "validation_error"
  | "product_missing"
  | "collection_missing"
  | "shop_unavailable"
  | "token_expired"
  | "graphql_user_error"
  | "mutation_not_supported"
  | "merchant_approval_required"
  | "verification_failed"
  | "dry_run_validation_failed";

const RETRYABLE_CODES = new Set<ShopifyErrorCode>([
  "rate_limited",
  "network_timeout",
  "token_expired",
]);

export class ShopifyExecutionError extends Error {
  readonly code: ShopifyErrorCode;
  readonly retryable: boolean;
  readonly details?: Record<string, unknown>;

  constructor(
    code: ShopifyErrorCode,
    message: string,
    options?: { retryable?: boolean; details?: Record<string, unknown> },
  ) {
    super(message);
    this.name = "ShopifyExecutionError";
    this.code = code;
    this.retryable = options?.retryable ?? RETRYABLE_CODES.has(code);
    this.details = options?.details;
  }
}

export function isShopifyExecutionError(error: unknown): error is ShopifyExecutionError {
  return error instanceof ShopifyExecutionError;
}

export function sanitizeErrorForLog(error: unknown): Record<string, unknown> {
  if (isShopifyExecutionError(error)) {
    return {
      name: error.name,
      code: error.code,
      message: error.message,
      retryable: error.retryable,
    };
  }

  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }

  return { message: "unknown_error" };
}
