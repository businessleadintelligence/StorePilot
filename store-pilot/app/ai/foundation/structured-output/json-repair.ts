export function repairJsonString(raw: string): string {
  let candidate = raw.trim();
  candidate = candidate.replace(/^```json\s*/i, "").replace(/```$/i, "");
  candidate = candidate.replace(/,\s*([}\]])/g, "$1");
  candidate = candidate.replace(/([{,]\s*)([a-zA-Z_][\w-]*)\s*:/g, '$1"$2":');
  candidate = candidate.replace(/^\{\s*([a-zA-Z_][\w-]*)\s*:/, '{"$1":');
  return candidate;
}

export function attemptJsonRepair(raw: string): unknown {
  const attempts = [raw, repairJsonString(raw)];
  let lastError: unknown;

  for (const attempt of attempts) {
    try {
      const start = attempt.indexOf("{");
      const end = attempt.lastIndexOf("}");
      const slice =
        start >= 0 && end > start ? attempt.slice(start, end + 1) : attempt;
      return JSON.parse(slice);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}
