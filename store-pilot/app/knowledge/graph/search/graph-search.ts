import prisma from "../../../db.server";
import type { GraphNodeRecord } from "../shared/types";

export async function indexGraphNode(node: GraphNodeRecord): Promise<void> {
  const tags = [
    node.nodeType.toLowerCase(),
    node.canonicalKey,
    ...(Array.isArray(node.metadata.tags)
      ? (node.metadata.tags as string[]).map(String)
      : []),
  ];
  await prisma.knowledgeGraphSearchIndex.create({
    data: {
      storeId: node.storeId,
      nodeId: node.id,
      searchText: `${node.displayName} ${node.nodeType} ${node.canonicalKey}`.toLowerCase(),
      tags,
      metadata: {
        nodeType: node.nodeType,
        canonicalKey: node.canonicalKey,
      },
    },
  }).catch(() => undefined);
}

export async function searchGraph(input: {
  storeId: string;
  query: string;
  tag?: string;
  nodeType?: string;
  limit?: number;
}) {
  const normalized = input.query.trim().toLowerCase();
  const rows = await prisma.knowledgeGraphSearchIndex.findMany({
    where: {
      storeId: input.storeId,
      searchText: normalized ? { contains: normalized } : undefined,
      tags: input.tag ? { has: input.tag } : undefined,
    },
    take: input.limit ?? 25,
    orderBy: { updatedAt: "desc" },
  });
  return rows.filter((row) =>
    input.nodeType ? row.metadata && (row.metadata as Record<string, string>).nodeType === input.nodeType : true,
  );
}

export async function searchByNodeId(storeId: string, nodeId: string) {
  return prisma.knowledgeGraphSearchIndex.findMany({
    where: { storeId, nodeId },
  });
}
