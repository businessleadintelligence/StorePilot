export function parseJsonSafely(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new SyntaxError("empty_json");
  }

  return JSON.parse(trimmed);
}

export function extractJsonObject(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  throw new SyntaxError("json_object_not_found");
}

export function roundUsd(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function createRequestId(prefix = "ai"): string {
  return `${prefix}-${crypto.randomUUID()}`;
}
