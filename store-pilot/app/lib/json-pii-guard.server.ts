import {
  assertFactsFreeOfCustomerPii,
  findProhibitedPiiFieldPaths,
  redactPotentialPiiInText,
} from "./privacy-by-architecture";

function collectStringLeafPaths(value: unknown, path = ""): Array<{ path: string; text: string }> {
  if (typeof value === "string") {
    return [{ path: path || "(root)", text: value }];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry, index) =>
      collectStringLeafPaths(entry, `${path}[${index}]`),
    );
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.entries(record).flatMap(([key, nested]) => {
      const nextPath = path ? `${path}.${key}` : key;
      return collectStringLeafPaths(nested, nextPath);
    });
  }

  return [];
}

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_PATTERN = /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/;

function findProhibitedPiiValuePaths(value: unknown): string[] {
  const matches: string[] = [];

  for (const leaf of collectStringLeafPaths(value)) {
    if (EMAIL_PATTERN.test(leaf.text) || PHONE_PATTERN.test(leaf.text)) {
      matches.push(leaf.path);
    }
  }

  return matches;
}

export function assertJsonPayloadFreeOfCustomerPii(
  value: unknown,
  context?: string,
): void {
  if (value === null || value === undefined) {
    return;
  }

  const fieldPaths = findProhibitedPiiFieldPaths(value).filter(
    (path) => !path.endsWith("shopifyCustomerId"),
  );

  if (fieldPaths.length > 0) {
    throw new Error(
      `json_payload_contains_prohibited_pii_fields${context ? `:${context}` : ""}:${fieldPaths.join(",")}`,
    );
  }

  const valuePaths = findProhibitedPiiValuePaths(value);
  if (valuePaths.length > 0) {
    throw new Error(
      `json_payload_contains_prohibited_pii_values${context ? `:${context}` : ""}:${valuePaths.join(",")}`,
    );
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    assertFactsFreeOfCustomerPii(value as Record<string, unknown>);
  }
}

export function scanJsonPayloadForCustomerPii(value: unknown): {
  fieldPaths: string[];
  valuePaths: string[];
} {
  return {
    fieldPaths: findProhibitedPiiFieldPaths(value).filter(
      (path) => !path.endsWith("shopifyCustomerId"),
    ),
    valuePaths: findProhibitedPiiValuePaths(value),
  };
}

export function sanitizeJsonPayloadForPersistence(value: unknown): unknown {
  if (typeof value === "string") {
    return redactPotentialPiiInText(value);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeJsonPayloadForPersistence(entry));
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const sanitized: Record<string, unknown> = {};

    for (const [key, nested] of Object.entries(record)) {
      sanitized[key] = sanitizeJsonPayloadForPersistence(nested);
    }

    return sanitized;
  }

  return value;
}
