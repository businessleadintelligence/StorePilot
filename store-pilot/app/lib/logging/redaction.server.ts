import { sanitizeLogContext } from "../privacy-by-architecture";

const SENSITIVE_KEY_PATTERN =
  /(token|secret|password|authorization|cookie|session|api[_-]?key|refresh|access[_-]?token|oauth|code|charge[_-]?id|payment|credential|hmac|signature)/i;

export const REDACTED_VALUE = "[redacted]";

export function isSensitiveLogKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERN.test(key.trim());
}

export function sanitizeLogContextDeep(
  context: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(context)) {
    if (isSensitiveLogKey(key)) {
      sanitized[key] = REDACTED_VALUE;
      continue;
    }

    if (value && typeof value === "object" && !Array.isArray(value)) {
      sanitized[key] = sanitizeLogContextDeep(value as Record<string, unknown>);
      continue;
    }

    sanitized[key] = value;
  }

  return sanitizeLogContext(sanitized);
}

export function redactLogContext(context: LogContextInput = {}): Record<string, unknown> {
  const { correlationId, shopifyRequestId, workerId, cronId, webhookId, aiRequestId, databaseRequestId, ...rest } =
    context;

  const sanitizedRest = sanitizeLogContextDeep(rest);

  return {
    ...(correlationId ? { correlationId } : {}),
    ...(shopifyRequestId ? { shopifyRequestId } : {}),
    ...(workerId ? { workerId } : {}),
    ...(cronId ? { cronId } : {}),
    ...(webhookId ? { webhookId } : {}),
    ...(aiRequestId ? { aiRequestId } : {}),
    ...(databaseRequestId ? { databaseRequestId } : {}),
    ...sanitizedRest,
  };
}

type LogContextInput = Record<string, unknown> & {
  correlationId?: string;
  shopifyRequestId?: string;
  workerId?: string;
  cronId?: string;
  webhookId?: string;
  aiRequestId?: string;
  databaseRequestId?: string;
};
