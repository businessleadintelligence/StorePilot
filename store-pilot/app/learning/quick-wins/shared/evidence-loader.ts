import prisma from "../../../db.server";
import type { EvidenceFactGroup } from "../shared/types";

type EvidenceRow = {
  id: string;
  factType: string;
  entityId: string;
  confidence: number;
};

export async function loadEvidenceForQuickWins(
  storeId: string,
): Promise<Map<string, EvidenceFactGroup>> {
  const rows = await prisma.evidence.findMany({
    where: { storeId, active: true },
    select: {
      id: true,
      factType: true,
      entityId: true,
      confidence: true,
    },
  });

  return buildEvidenceFactGroups(
    rows.map((row) => ({
      id: row.id,
      factType: row.factType,
      entityId: row.entityId,
      confidence: Number(row.confidence),
    })),
  );
}

export function buildEvidenceFactGroups(
  rows: EvidenceRow[],
): Map<string, EvidenceFactGroup> {
  const groups = new Map<string, EvidenceFactGroup>();

  for (const row of rows) {
    const existing = groups.get(row.factType);
    if (!existing) {
      groups.set(row.factType, {
        factType: row.factType,
        count: 1,
        evidenceIds: [row.id],
        avgConfidence: row.confidence,
      });
      continue;
    }

    existing.count += 1;
    existing.evidenceIds.push(row.id);
    existing.avgConfidence =
      (existing.avgConfidence * (existing.count - 1) + row.confidence) / existing.count;
  }

  return groups;
}

export function getEntityIdsByFactTypes(
  rows: EvidenceRow[],
  factTypes: string[],
): Set<string> {
  const factTypeSet = new Set(factTypes);
  const entityIds = new Set<string>();

  for (const row of rows) {
    if (factTypeSet.has(row.factType)) {
      entityIds.add(row.entityId);
    }
  }

  return entityIds;
}

export function getEvidenceIdsForFactTypes(
  groups: Map<string, EvidenceFactGroup>,
  factTypes: string[],
): string[] {
  const ids: string[] = [];
  for (const factType of factTypes) {
    const group = groups.get(factType);
    if (group) {
      ids.push(...group.evidenceIds);
    }
  }
  return [...new Set(ids)];
}

export function countUnionForFactTypes(
  groups: Map<string, EvidenceFactGroup>,
  factTypes: string[],
): number {
  let total = 0;
  for (const factType of factTypes) {
    total += groups.get(factType)?.count ?? 0;
  }
  return total;
}

export function averageConfidenceForFactTypes(
  groups: Map<string, EvidenceFactGroup>,
  factTypes: string[],
): number {
  let sum = 0;
  let count = 0;
  for (const factType of factTypes) {
    const group = groups.get(factType);
    if (group && group.count > 0) {
      sum += group.avgConfidence * group.count;
      count += group.count;
    }
  }
  return count > 0 ? sum / count : 0.75;
}
