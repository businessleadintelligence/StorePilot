import type { KnowledgeGraphEdgeType, Prisma } from "@prisma/client";

import prisma from "../../../db.server";
import type { GraphEdgeRecord } from "../shared/types";

export type UpsertGraphEdgeInput = {
  storeId: string;
  fromNodeId: string;
  toNodeId: string;
  relationship: KnowledgeGraphEdgeType;
  source: string;
  confidence?: number;
  evidenceId?: string | null;
  evidenceVersion?: number | null;
  evidenceSource?: string | null;
  observationCount?: number;
  freshnessMinutes?: number | null;
  strength?: number | null;
  weight?: number | null;
  expiresAt?: Date | null;
};

export class GraphEdgeStore {
  async upsert(input: UpsertGraphEdgeInput): Promise<{ edge: GraphEdgeRecord; created: boolean }> {
    const existing = await prisma.knowledgeGraphEdge.findUnique({
      where: {
        storeId_fromNodeId_toNodeId_relationship: {
          storeId: input.storeId,
          fromNodeId: input.fromNodeId,
          toNodeId: input.toNodeId,
          relationship: input.relationship,
        },
      },
    });

    if (!existing) {
      const created = await prisma.knowledgeGraphEdge.create({
        data: {
          storeId: input.storeId,
          fromNodeId: input.fromNodeId,
          toNodeId: input.toNodeId,
          relationship: input.relationship,
          source: input.source,
          confidence: input.confidence ?? 1,
          evidenceId: input.evidenceId ?? null,
          evidenceVersion: input.evidenceVersion ?? null,
          evidenceSource: input.evidenceSource ?? null,
          observationCount: input.observationCount ?? 1,
          freshnessMinutes: input.freshnessMinutes ?? null,
          strength: input.strength ?? null,
          weight: input.weight ?? null,
          expiresAt: input.expiresAt ?? null,
          active: true,
        },
      });
      return { edge: mapEdge(created), created: true };
    }

    const updated = await prisma.knowledgeGraphEdge.update({
      where: { id: existing.id },
      data: {
        confidence: input.confidence ?? Number(existing.confidence),
        evidenceId: input.evidenceId ?? existing.evidenceId,
        evidenceVersion: input.evidenceVersion ?? existing.evidenceVersion,
        evidenceSource: input.evidenceSource ?? existing.evidenceSource,
        observationCount: { increment: 1 },
        freshnessMinutes: input.freshnessMinutes ?? existing.freshnessMinutes,
        strength: input.strength ?? existing.strength,
        weight: input.weight ?? existing.weight,
        active: true,
      },
    });
    return { edge: mapEdge(updated), created: false };
  }

  async listForNode(input: {
    storeId: string;
    nodeId: string;
    direction?: "out" | "in" | "both";
    activeOnly?: boolean;
  }): Promise<GraphEdgeRecord[]> {
    const activeOnly = input.activeOnly ?? true;
    const outgoing =
      input.direction === "in"
        ? []
        : await prisma.knowledgeGraphEdge.findMany({
            where: {
              storeId: input.storeId,
              fromNodeId: input.nodeId,
              active: activeOnly ? true : undefined,
            },
          });
    const incoming =
      input.direction === "out"
        ? []
        : await prisma.knowledgeGraphEdge.findMany({
            where: {
              storeId: input.storeId,
              toNodeId: input.nodeId,
              active: activeOnly ? true : undefined,
            },
          });
    return [...outgoing, ...incoming].map(mapEdge);
  }

  async listByStore(input: {
    storeId: string;
    take?: number;
    skip?: number;
    activeOnly?: boolean;
  }): Promise<GraphEdgeRecord[]> {
    const rows = await prisma.knowledgeGraphEdge.findMany({
      where: {
        storeId: input.storeId,
        active: input.activeOnly === false ? undefined : true,
      },
      orderBy: { createdAt: "asc" },
      take: input.take ?? 500,
      skip: input.skip ?? 0,
    });
    return rows.map(mapEdge);
  }

  async deactivateForNode(nodeId: string): Promise<number> {
    const result = await prisma.knowledgeGraphEdge.updateMany({
      where: {
        OR: [{ fromNodeId: nodeId }, { toNodeId: nodeId }],
      },
      data: { active: false },
    });
    return result.count;
  }

  async getById(edgeId: string): Promise<GraphEdgeRecord | null> {
    const row = await prisma.knowledgeGraphEdge.findUnique({ where: { id: edgeId } });
    return row ? mapEdge(row) : null;
  }

  async countByStore(storeId: string): Promise<number> {
    return prisma.knowledgeGraphEdge.count({ where: { storeId, active: true } });
  }
}

function mapEdge(row: {
  id: string;
  storeId: string;
  fromNodeId: string;
  toNodeId: string;
  relationship: KnowledgeGraphEdgeType;
  confidence: Prisma.Decimal | number;
  source: string;
  evidenceId: string | null;
  evidenceVersion: number | null;
  evidenceSource: string | null;
  observationCount: number;
  freshnessMinutes: number | null;
  strength: Prisma.Decimal | number | null;
  weight: Prisma.Decimal | number | null;
  active: boolean;
}): GraphEdgeRecord {
  return {
    id: row.id,
    storeId: row.storeId,
    fromNodeId: row.fromNodeId,
    toNodeId: row.toNodeId,
    relationship: row.relationship,
    confidence: Number(row.confidence),
    source: row.source,
    evidenceId: row.evidenceId,
    evidenceVersion: row.evidenceVersion,
    evidenceSource: row.evidenceSource,
    observationCount: row.observationCount,
    freshnessMinutes: row.freshnessMinutes,
    strength: row.strength === null ? null : Number(row.strength),
    weight: row.weight === null ? null : Number(row.weight),
    active: row.active,
  };
}

export function createGraphEdgeStore(): GraphEdgeStore {
  return new GraphEdgeStore();
}
