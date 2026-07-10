const PII_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  {
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    replacement: "[REDACTED_EMAIL]",
  },
  {
    pattern: /\b(?:\+?\d[\d\s().-]{7,}\d)\b/g,
    replacement: "[REDACTED_PHONE]",
  },
  {
    pattern: /\b(?:visa|mastercard|amex|discover)\b[^\n]*/gi,
    replacement: "[REDACTED_PAYMENT]",
  },
  {
    pattern:
      /\b\d{1,5}\s+[A-Za-z0-9.\s-]+(?:street|st|road|rd|avenue|ave|lane|ln|drive|dr|boulevard|blvd)\b/gi,
    replacement: "[REDACTED_ADDRESS]",
  },
];

const BLOCKED_FIELD_NAMES = new Set([
  "email",
  "phone",
  "phoneNumber",
  "address",
  "address1",
  "address2",
  "customerName",
  "firstName",
  "lastName",
  "paymentMethod",
  "creditCard",
  "billingAddress",
  "shippingAddress",
]);

export function sanitizeTextForAi(text: string): string {
  let sanitized = text;
  for (const rule of PII_PATTERNS) {
    sanitized = sanitized.replace(rule.pattern, rule.replacement);
  }
  return sanitized;
}

export function sanitizeVariablesForAi(
  variables: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!variables) {
    return undefined;
  }

  return sanitizeValue(variables) as Record<string, unknown>;
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") {
    return sanitizeTextForAi(value);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeValue(entry));
  }

  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (BLOCKED_FIELD_NAMES.has(key)) {
        continue;
      }
      result[key] = sanitizeValue(entry);
    }
    return result;
  }

  return value;
}

export function sanitizeMessagesForAi<T extends { role: string; content: string }>(
  messages: T[],
): T[] {
  return messages.map((message) => ({
    ...message,
    content: sanitizeTextForAi(message.content),
  }));
}
