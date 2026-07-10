import type { EvidenceFactGroup, QuickWinCandidate } from "../shared/types";
import {
  averageConfidenceForFactTypes,
  countUnionForFactTypes,
  getEvidenceIdsForFactTypes,
} from "../shared/evidence-loader";
import { QUICK_WIN_DEFINITIONS } from "../shared/constants";
import { detectSlowMovingProducts } from "../catalog/slow-moving";

type EvidenceRow = {
  id: string;
  factType: string;
  entityId: string;
  confidence: number;
};

export function buildQuickWinCandidates(input: {
  groups: Map<string, EvidenceFactGroup>;
  evidenceRows: EvidenceRow[];
}): QuickWinCandidate[] {
  const candidates: QuickWinCandidate[] = [];

  for (const definition of QUICK_WIN_DEFINITIONS) {
    if (definition.winType === "slow_moving_product") {
      const slowMoving = detectSlowMovingProducts(input.evidenceRows);
      if (slowMoving.affectedCount === 0) {
        continue;
      }
      candidates.push({
        winType: definition.winType,
        category: definition.category,
        title: definition.title(slowMoving.affectedCount),
        description: definition.description,
        affectedCount: slowMoving.affectedCount,
        evidenceIds: slowMoving.evidenceIds.slice(0, 50),
        sourceFactTypes: definition.factTypes,
        avgConfidence: slowMoving.avgConfidence,
        effort: definition.effort,
        impactWeight: definition.impactWeight,
        urgencyBoost: definition.urgencyBoost,
      });
      continue;
    }

    const affectedCount = countUnionForFactTypes(input.groups, definition.factTypes);
    if (affectedCount === 0) {
      continue;
    }

    candidates.push({
      winType: definition.winType,
      category: definition.category,
      title: definition.title(affectedCount),
      description: definition.description,
      affectedCount,
      evidenceIds: getEvidenceIdsForFactTypes(input.groups, definition.factTypes).slice(
        0,
        50,
      ),
      sourceFactTypes: definition.factTypes,
      avgConfidence: averageConfidenceForFactTypes(
        input.groups,
        definition.factTypes,
      ),
      effort: definition.effort,
      impactWeight: definition.impactWeight,
      urgencyBoost: definition.urgencyBoost,
    });
  }

  return candidates;
}
