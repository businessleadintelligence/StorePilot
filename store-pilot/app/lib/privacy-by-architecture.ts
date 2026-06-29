/**
 * Privacy-by-Architecture helpers.
 * StorePilot is a business intelligence platform — not a CRM.
 */

import { createHash } from "node:crypto";

export const PROHIBITED_PII_FIELD_NAMES = [
  "customerEmail",
  "customer_email",
  "email",
  "phone",
  "phoneNumber",
  "address",
  "shippingAddress",
  "billingAddress",
  "firstName",
  "lastName",
  "customerName",
  "customerId",
  "shopifyCustomerId",
  "zip",
  "postalCode",
  "province",
  "country",
  "company",
  "customerNote",
  "customerTags",
  "marketingConsent",
] as const;

export const MINIMUM_SHOPIFY_SCOPES = [
  "read_products",
  "read_inventory",
  "write_products",
  "read_orders",
] as const;

export const PROHIBITED_SHOPIFY_SCOPES = [
  "read_customers",
  "write_customers",
  "read_customer_events",
  "write_customer_events",
  "read_marketing_events",
  "write_marketing_events",
] as const;

const PII_VALUE_PATTERNS = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/,
];

export function containsProhibitedPiiFieldName(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return PROHIBITED_PII_FIELD_NAMES.some((candidate) => normalized === candidate.toLowerCase());
}

export function findProhibitedPiiFieldPaths(
  value: unknown,
  path = "",
): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => findProhibitedPiiFieldPaths(entry, `${path}[${index}]`));
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const matches: string[] = [];

    for (const [key, nested] of Object.entries(record)) {
      const nextPath = path ? `${path}.${key}` : key;

      if (containsProhibitedPiiFieldName(key) && key !== "shopifyCustomerId") {
        matches.push(nextPath);
      }

      matches.push(...findProhibitedPiiFieldPaths(nested, nextPath));
    }

    return matches;
  }

  return [];
}

export function redactPotentialPiiInText(text: string): string {
  return PII_VALUE_PATTERNS.reduce(
    (current, pattern) => current.replace(pattern, "[redacted]"),
    text,
  );
}

export function hashIdentifierForLog(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex").slice(0, 16);
}

export function sanitizeLogContext(
  context: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(context)) {
    if (key === "shopifyCustomerId" && typeof value === "string") {
      sanitized.customerIdHash = hashIdentifierForLog(value);
      continue;
    }

    if (typeof value === "string") {
      sanitized[key] = redactPotentialPiiInText(value);
      continue;
    }

    sanitized[key] = value;
  }

  return sanitized;
}

export function assertFactsFreeOfCustomerPii(facts: Record<string, unknown>): void {
  const paths = findProhibitedPiiFieldPaths(facts).filter(
    (path) => !path.endsWith("shopifyCustomerId"),
  );

  if (paths.length > 0) {
    throw new Error(`facts_contain_prohibited_pii:${paths.join(",")}`);
  }
}

export function parseConfiguredScopes(scopeString: string | undefined): string[] {
  if (!scopeString) return [];
  return scopeString
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);
}

export function validateMinimumShopifyScopes(scopeString: string | undefined): {
  configured: string[];
  prohibited: string[];
  missingRequired: string[];
} {
  const configured = parseConfiguredScopes(scopeString);
  const prohibited = configured.filter((scope) =>
    PROHIBITED_SHOPIFY_SCOPES.includes(scope as (typeof PROHIBITED_SHOPIFY_SCOPES)[number]),
  );
  const missingRequired = MINIMUM_SHOPIFY_SCOPES.filter((scope) => !configured.includes(scope));

  return { configured, prohibited, missingRequired };
}
