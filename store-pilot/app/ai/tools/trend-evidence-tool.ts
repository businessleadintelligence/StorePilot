export type TrendEvidenceEntry = {
  key: string;
  section: string;
  label: string;
  value: string | number | boolean;
};

export function buildTrendEvidenceCatalogMap(
  entries: TrendEvidenceEntry[],
): Record<string, TrendEvidenceEntry> {
  return Object.fromEntries(entries.map((entry) => [entry.key, entry]));
}

export function validateTrendEvidenceKeys(
  keys: string[],
  catalog: Record<string, TrendEvidenceEntry>,
): { valid: boolean; unknownKeys: string[] } {
  const unknownKeys = keys.filter((key) => !catalog[key]);
  return { valid: unknownKeys.length === 0, unknownKeys };
}

export function trendEvidenceKey(metric: string): string {
  return metric;
}
