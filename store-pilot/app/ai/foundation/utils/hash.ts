import { createHash } from "node:crypto";

export function hashString(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hashObject(value: unknown): string {
  return hashString(stableStringify(value));
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

export function buildPromptHash(input: {
  promptId: string;
  promptVersion: string;
  body: string;
}): string {
  return hashString(`${input.promptId}:${input.promptVersion}:${input.body}`);
}

export function buildRequestFingerprint(input: {
  storeId: string;
  feature: string;
  subjectKey?: string;
  promptHash: string;
  variablesHash: string;
}): string {
  const digest = hashString(
    [
      input.storeId,
      input.feature,
      input.subjectKey ?? "default",
      input.promptHash,
      input.variablesHash,
    ].join(":"),
  );
  return `${input.storeId}:${input.feature}:${digest}`;
}
