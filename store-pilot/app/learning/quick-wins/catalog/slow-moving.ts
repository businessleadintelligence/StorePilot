import type { EvidenceRow } from "../shared/types";

export function detectSlowMovingProducts(rows: EvidenceRow[]): {
  affectedCount: number;
  evidenceIds: string[];
  avgConfidence: number;
} {
  const neverSoldEntities = new Set<string>();
  const highInventoryEntities = new Set<string>();
  const neverSoldIds: string[] = [];
  const highInventoryIds: string[] = [];

  for (const row of rows) {
    if (row.factType === "NeverSold") {
      neverSoldEntities.add(row.entityId);
      neverSoldIds.push(row.id);
    }
    if (row.factType === "HighInventory") {
      highInventoryEntities.add(row.entityId);
      highInventoryIds.push(row.id);
    }
  }

  const intersection = [...neverSoldEntities].filter((entityId) =>
    highInventoryEntities.has(entityId),
  );

  const evidenceIds = [...new Set([...neverSoldIds, ...highInventoryIds])];
  const avgConfidence =
    rows.length > 0
      ? rows.reduce((sum, row) => sum + row.confidence, 0) / rows.length
      : 0.75;

  return {
    affectedCount: intersection.length,
    evidenceIds,
    avgConfidence,
  };
}
