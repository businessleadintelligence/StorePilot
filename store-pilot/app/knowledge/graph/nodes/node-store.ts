import type {
  KnowledgeGraphNodeStatus,
  KnowledgeGraphNodeType,
  Prisma,
} from "@prisma/client";

import prisma from "../../../db.server";
import { assertJsonPayloadFreeOfCustomerPii } from "../../../lib/json-pii-guard.server";
import type { GraphNodeRecord } from "../shared/types";

export type UpsertGraphNodeInput = {
  storeId: string;
  nodeType: KnowledgeGraphNodeType;
  canonicalKey: string;
  displayName: string;
  status?: KnowledgeGraphNodeStatus;
  confidence?: number;
  metadata?: Record<string, unknown>;
  evidenceId?: string | null;
};

export class GraphNodeStore {
  async upsert(input: UpsertGraphNodeInput): Promise<{ node: GraphNodeRecord; created: boolean }> {
    if (input.metadata) {
      assertJsonPayloadFreeOfCustomerPii(input.metadata, "KnowledgeGraphNode.metadata");
    }

    const existing = await prisma.knowledgeGraphNode.findUnique({
      where: {
        storeId_nodeType_canonicalKey: {
          storeId: input.storeId,
          nodeType: input.nodeType,
          canonicalKey: input.canonicalKey,
        },
      },
    });

    if (!existing) {
      const created = await prisma.knowledgeGraphNode.create({
        data: {
          storeId: input.storeId,
          nodeType: input.nodeType,
          canonicalKey: input.canonicalKey,
          displayName: input.displayName,
          status: input.status ?? "active",
          confidence: input.confidence ?? 1,
          metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
          evidenceId: input.evidenceId ?? null,
        },
      });
      return { node: mapNode(created), created: true };
    }

    const updated = await prisma.knowledgeGraphNode.update({
      where: { id: existing.id },
      data: {
        displayName: input.displayName,
        status: input.status ?? existing.status,
        confidence: input.confidence ?? Number(existing.confidence),
        metadata: (input.metadata ?? existing.metadata) as Prisma.InputJsonValue,
        evidenceId: input.evidenceId ?? existing.evidenceId,
        version: { increment: 1 },
      },
    });
    return { node: mapNode(updated), created: false };
  }

  async getByCanonicalKey(input: {
    storeId: string;
    nodeType: KnowledgeGraphNodeType;
    canonicalKey: string;
  }): Promise<GraphNodeRecord | null> {
    const row = await prisma.knowledgeGraphNode.findUnique({
      where: {
        storeId_nodeType_canonicalKey: {
          storeId: input.storeId,
          nodeType: input.nodeType,
          canonicalKey: input.canonicalKey,
        },
      },
    });
    return row ? mapNode(row) : null;
  }

  async getById(nodeId: string): Promise<GraphNodeRecord | null> {
    const row = await prisma.knowledgeGraphNode.findUnique({ where: { id: nodeId } });
    return row ? mapNode(row) : null;
  }

  async listByStore(input: {
    storeId: string;
    nodeType?: KnowledgeGraphNodeType;
    status?: KnowledgeGraphNodeStatus;
    take?: number;
    skip?: number;
  }): Promise<GraphNodeRecord[]> {
    const rows = await prisma.knowledgeGraphNode.findMany({
      where: {
        storeId: input.storeId,
        nodeType: input.nodeType,
        status: input.status,
      },
      orderBy: { updatedAt: "asc" },
      take: input.take ?? 100,
      skip: input.skip ?? 0,
    });
    return rows.map(mapNode);
  }

  async countByStore(storeId: string): Promise<number> {
    return prisma.knowledgeGraphNode.count({ where: { storeId, status: "active" } });
  }

  async archive(input: {
    storeId: string;
    nodeType: KnowledgeGraphNodeType;
    canonicalKey: string;
  }): Promise<boolean> {
    const result = await prisma.knowledgeGraphNode.updateMany({
      where: {
        storeId: input.storeId,
        nodeType: input.nodeType,
        canonicalKey: input.canonicalKey,
      },
      data: { status: "archived" },
    });
    return result.count > 0;
  }
}

function mapNode(row: {
  id: string;
  storeId: string;
  nodeType: KnowledgeGraphNodeType;
  canonicalKey: string;
  displayName: string;
  status: KnowledgeGraphNodeStatus;
  version: number;
  confidence: Prisma.Decimal | number;
  metadata: unknown;
  evidenceId: string | null;
}): GraphNodeRecord {
  return {
    id: row.id,
    storeId: row.storeId,
    nodeType: row.nodeType,
    canonicalKey: row.canonicalKey,
    displayName: row.displayName,
    status: row.status,
    version: row.version,
    confidence: Number(row.confidence),
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    evidenceId: row.evidenceId,
  };
}

export function createGraphNodeStore(): GraphNodeStore {
  return new GraphNodeStore();
}
