import { sanitizeLogContext } from "./privacy-by-architecture";

const SENSITIVE_KEY_PATTERN =
  /(token|secret|password|authorization|cookie|session|api[_-]?key|refresh|access[_-]?token|oauth|code|charge[_-]?id|payment|credential|hmac|signature)/i;

const REDACTED = "[redacted]";

export function isSensitiveLogKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERN.test(key.trim());
}

export function sanitizeLogContextDeep(
  context: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(context)) {
    if (isSensitiveLogKey(key)) {
      sanitized[key] = REDACTED;
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

export function createSafeLogger(prefix: string) {
  return {
    info(message: string, context: Record<string, unknown> = {}): void {
      console.info(prefix, sanitizeLogContextDeep({ message, ...context }));
    },
    warn(message: string, context: Record<string, unknown> = {}): void {
      console.warn(prefix, sanitizeLogContextDeep({ message, ...context }));
    },
    error(message: string, context: Record<string, unknown> = {}): void {
      console.error(prefix, sanitizeLogContextDeep({ message, ...context }));
    },
  };
}
