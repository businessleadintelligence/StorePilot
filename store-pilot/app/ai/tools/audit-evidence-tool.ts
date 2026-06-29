export type StoreAuditEvidenceEntry = {
  key: string;
  section: string;
  label: string;
  value: string | number | boolean;
  severity: "info" | "warning" | "critical";
};

export function buildStoreAuditEvidenceCatalog(
  entries: StoreAuditEvidenceEntry[],
): Record<string, StoreAuditEvidenceEntry> {
  return Object.fromEntries(entries.map((entry) => [entry.key, entry]));
}

export function resolveStoreAuditEvidenceKeys(
  keys: string[],
  catalog: Record<string, StoreAuditEvidenceEntry>,
): StoreAuditEvidenceEntry[] {
  return keys
    .map((key) => catalog[key])
    .filter((entry): entry is StoreAuditEvidenceEntry => Boolean(entry));
}

export function validateStoreAuditEvidenceKeys(
  keys: string[],
  catalog: Record<string, StoreAuditEvidenceEntry>,
): { valid: boolean; unknownKeys: string[] } {
  const unknownKeys = keys.filter((key) => !catalog[key]);
  return { valid: unknownKeys.length === 0, unknownKeys };
}

export function evidenceKeyFor(section: string, metric: string): string {
  return `${section.toLowerCase().replace(/\s+/g, "_")}.${metric}`;
}
