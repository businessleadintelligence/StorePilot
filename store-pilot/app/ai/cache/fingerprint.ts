import { createHash } from "node:crypto";

export function sha256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sortKeys(entry));
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.keys(record)
      .sort()
      .reduce<Record<string, unknown>>((accumulator, key) => {
        accumulator[key] = sortKeys(record[key]);
        return accumulator;
      }, {});
  }

  return value;
}

export function buildSubjectKey(
  agentId: string,
  context: Record<string, unknown>,
): string {
  const explicit = context.subjectKey;
  if (typeof explicit === "string" && explicit.trim()) {
    return explicit.trim();
  }

  const parts = Object.keys(context)
    .sort()
    .map((key) => `${key}:${String(context[key])}`);

  return sha256(`${agentId}|${parts.join("|")}`);
}

export type CacheFingerprintInput = {
  agentId: string;
  storeId: string;
  subjectKey: string;
  factFingerprint: string;
  promptVersion: string;
  promptChecksum: string;
};

export function buildCacheFingerprint(input: CacheFingerprintInput): string {
  return sha256(
    [
      input.agentId,
      input.storeId,
      input.subjectKey,
      input.factFingerprint,
      input.promptVersion,
      input.promptChecksum,
    ].join("|"),
  );
}

export function buildFactFingerprint(facts: Record<string, unknown>): string {
  const { computedAt: _computedAt, ...stableFacts } = facts;
  return sha256(stableStringify(stableFacts));
}

export function buildRecommendationStableId(input: {
  storeId: string;
  agentId: string;
  subjectKey: string;
  category: string;
  title: string;
}): string {
  return sha256(
    [
      input.storeId,
      input.agentId,
      input.subjectKey,
      input.category,
      input.title.trim().toLowerCase(),
    ].join("|"),
  );
}

export function buildPromptChecksum(body: string): string {
  return sha256(body.trim());
}
