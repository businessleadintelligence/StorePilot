import type { EvidenceChangeType, Prisma } from "@prisma/client";

import { assertJsonPayloadFreeOfCustomerPii } from "../../lib/json-pii-guard.server";
import prisma from "../../db.server";
import { computeQualityScores } from "../quality/quality-scorer";
import type { EvidenceDraft } from "../shared/types";
import {
  validateEvidenceDraft,
  validateObservationDedupeKey,
} from "../validators/evidence-validator";

export type UpsertEvidenceResult = {
  created: boolean;
  updated: boolean;
  evidenceId: string;
};

export class EvidenceStore {
  async ensureSource(input: {
    storeId: string;
    sourceType: string;
    sourceRef: string;
    priority?: number;
  }): Promise<string> {
    const row = await prisma.evidenceSource.upsert({
      where: {
        storeId_sourceType_sourceRef: {
          storeId: input.storeId,
          sourceType: input.sourceType,
          sourceRef: input.sourceRef,
        },
      },
      create: {
        storeId: input.storeId,
        sourceType: input.sourceType,
        sourceRef: input.sourceRef,
        priority: input.priority ?? 100,
        lastSyncAt: new Date(),
      },
      update: {
        priority: input.priority ?? 100,
        lastSyncAt: new Date(),
      },
    });
    return row.id;
  }

  async upsertEvidence(input: {
    storeId: string;
    draft: EvidenceDraft;
    sourceId: string;
    fieldsExpected?: number;
    fieldsPresent?: number;
  }): Promise<UpsertEvidenceResult> {
    validateEvidenceDraft(input.draft);
    const quality = computeQualityScores({
      sourcePriority: 100,
      observedAt: input.draft.observedAt,
      fieldsExpected: input.fieldsExpected ?? 5,
      fieldsPresent: input.fieldsPresent ?? 5,
    });

    const existing = await prisma.evidence.findUnique({
      where: {
        storeId_entity_entityId_factType: {
          storeId: input.storeId,
          entity: input.draft.entity,
          entityId: input.draft.entityId,
          factType: input.draft.factType,
        },
      },
    });

    const valueJson =
      input.draft.value === undefined || input.draft.value === null
        ? undefined
        : (input.draft.value as Prisma.InputJsonValue);

    if (valueJson !== undefined) {
      assertJsonPayloadFreeOfCustomerPii(valueJson, "Evidence.value");
    }

    if (!existing) {
      const created = await prisma.evidence.create({
        data: {
          storeId: input.storeId,
          entity: input.draft.entity,
          entityId: input.draft.entityId,
          factType: input.draft.factType,
          value: valueJson,
          sourceId: input.sourceId,
          confidence: quality.confidence,
          freshnessMinutes: quality.freshnessMinutes,
          completeness: quality.completeness,
          reliability: quality.reliability,
          observationCount: quality.observationCount,
          sourcePriority: quality.sourcePriority,
          observedAt: input.draft.observedAt,
          active: true,
        },
      });
      await this.recordHistory({
        evidenceId: created.id,
        storeId: input.storeId,
        changeType: "created",
        snapshot: created,
      });
      await this.recordObservation({
        storeId: input.storeId,
        evidenceId: created.id,
        sourceId: input.sourceId,
        observedAt: input.draft.observedAt,
        value: input.draft.value,
        dedupeKey: buildDedupeKey(input.storeId, input.draft),
      });
      return { created: true, updated: false, evidenceId: created.id };
    }

    const updated = await prisma.evidence.update({
      where: { id: existing.id },
      data: {
        value: valueJson,
        sourceId: input.sourceId,
        confidence: quality.confidence,
        freshnessMinutes: quality.freshnessMinutes,
        completeness: quality.completeness,
        reliability: quality.reliability,
        observationCount: { increment: 1 },
        sourcePriority: quality.sourcePriority,
        observedAt: input.draft.observedAt,
        version: { increment: 1 },
        active: true,
      },
    });
    await this.recordHistory({
      evidenceId: updated.id,
      storeId: input.storeId,
      changeType: "updated",
      snapshot: updated,
    });
    await this.recordObservation({
      storeId: input.storeId,
      evidenceId: updated.id,
      sourceId: input.sourceId,
      observedAt: input.draft.observedAt,
      value: input.draft.value,
      dedupeKey: buildDedupeKey(input.storeId, input.draft, input.draft.observedAt.toISOString()),
    });
    return { created: false, updated: true, evidenceId: updated.id };
  }

  async expireStaleEvidence(input: {
    storeId: string;
    factType: string;
    entityId: string;
    entity: EvidenceDraft["entity"];
  }): Promise<boolean> {
    const existing = await prisma.evidence.findUnique({
      where: {
        storeId_entity_entityId_factType: {
          storeId: input.storeId,
          entity: input.entity,
          entityId: input.entityId,
          factType: input.factType,
        },
      },
    });
    if (!existing || !existing.active) {
      return false;
    }
    const updated = await prisma.evidence.update({
      where: { id: existing.id },
      data: { active: false },
    });
    await this.recordHistory({
      evidenceId: updated.id,
      storeId: input.storeId,
      changeType: "expired",
      snapshot: updated,
    });
    return true;
  }

  async countByFactTypes(storeId: string, factTypes: string[]): Promise<number> {
    return prisma.evidence.count({
      where: {
        storeId,
        active: true,
        factType: { in: factTypes },
      },
    });
  }

  private async recordHistory(input: {
    evidenceId: string;
    storeId: string;
    changeType: EvidenceChangeType;
    snapshot: unknown;
  }): Promise<void> {
    assertJsonPayloadFreeOfCustomerPii(input.snapshot, "EvidenceHistory.snapshot");
    await prisma.evidenceHistory.create({
      data: {
        evidenceId: input.evidenceId,
        storeId: input.storeId,
        changeType: input.changeType,
        snapshot: input.snapshot as Prisma.InputJsonValue,
      },
    });
  }

  private async recordObservation(input: {
    storeId: string;
    evidenceId: string;
    sourceId: string;
    observedAt: Date;
    value: EvidenceDraft["value"];
    dedupeKey: string;
  }): Promise<void> {
    validateObservationDedupeKey(input.dedupeKey);
    assertJsonPayloadFreeOfCustomerPii(input.value, "EvidenceObservation.value");
    try {
      await prisma.evidenceObservation.create({
        data: {
          storeId: input.storeId,
          evidenceId: input.evidenceId,
          sourceId: input.sourceId,
          observedAt: input.observedAt,
          value: toJsonValue(input.value),
          dedupeKey: input.dedupeKey,
        },
      });
    } catch {
      // Duplicate observation — idempotent ingest
    }
  }
}

function buildDedupeKey(
  storeId: string,
  draft: EvidenceDraft,
  suffix = "base",
): string {
  return `${storeId}:${draft.entity}:${draft.entityId}:${draft.factType}:${suffix}`;
}

function toJsonValue(value: EvidenceDraft["value"]): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  return value as Prisma.InputJsonValue;
}

export function createEvidenceStore(): EvidenceStore {
  return new EvidenceStore();
}
