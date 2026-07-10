import prisma from "../../../db.server";
import type { GraphStatisticsSnapshot } from "../shared/types";

export async function computeGraphStatistics(
  storeId: string,
): Promise<GraphStatisticsSnapshot> {
  const [totalNodes, totalEdges, evidenceCount, activeEvidenceCount] = await Promise.all([
    prisma.knowledgeGraphNode.count({ where: { storeId, status: "active" } }),
    prisma.knowledgeGraphEdge.count({ where: { storeId, active: true } }),
    prisma.evidence.count({ where: { storeId } }),
    prisma.evidence.count({ where: { storeId, active: true } }),
  ]);

  const averageDegree = totalNodes > 0 ? (totalEdges * 2) / totalNodes : 0;
  const maxPossibleEdges = totalNodes > 1 ? totalNodes * (totalNodes - 1) : 1;
  const graphDensity = maxPossibleEdges > 0 ? totalEdges / maxPossibleEdges : 0;

  const { connectedComponents, disconnectedNodes } = await computeComponents(storeId);

  const businessNodes = await prisma.knowledgeGraphNode.count({
    where: {
      storeId,
      status: "active",
      nodeType: { in: ["Product", "Variant", "Collection", "Order"] },
    },
  });

  const relationshipRows = await prisma.knowledgeGraphRelationship.count({
    where: { storeId, active: true },
  });

  return {
    totalNodes,
    totalEdges,
    averageDegree: round(averageDegree),
    connectedComponents,
    disconnectedNodes,
    graphDensity: round(graphDensity, 6),
    evidenceCoverage: evidenceCount > 0 ? round(activeEvidenceCount / evidenceCount) : 0,
    businessCoverage: totalNodes > 0 ? round(businessNodes / totalNodes) : 0,
    relationshipCoverage:
      totalEdges > 0 ? round(relationshipRows / totalEdges) : 0,
  };
}

export async function persistGraphStatistics(
  storeId: string,
  stats: GraphStatisticsSnapshot,
): Promise<void> {
  await prisma.knowledgeGraphStatistics.upsert({
    where: { storeId },
    create: {
      storeId,
      totalNodes: stats.totalNodes,
      totalEdges: stats.totalEdges,
      averageDegree: stats.averageDegree,
      connectedComponents: stats.connectedComponents,
      disconnectedNodes: stats.disconnectedNodes,
      graphDensity: stats.graphDensity,
      evidenceCoverage: stats.evidenceCoverage,
      businessCoverage: stats.businessCoverage,
      relationshipCoverage: stats.relationshipCoverage,
      lastComputedAt: new Date(),
    },
    update: {
      totalNodes: stats.totalNodes,
      totalEdges: stats.totalEdges,
      averageDegree: stats.averageDegree,
      connectedComponents: stats.connectedComponents,
      disconnectedNodes: stats.disconnectedNodes,
      graphDensity: stats.graphDensity,
      evidenceCoverage: stats.evidenceCoverage,
      businessCoverage: stats.businessCoverage,
      relationshipCoverage: stats.relationshipCoverage,
      lastComputedAt: new Date(),
    },
  });
}

async function computeComponents(storeId: string): Promise<{
  connectedComponents: number;
  disconnectedNodes: number;
}> {
  const edges = await prisma.knowledgeGraphEdge.findMany({
    where: { storeId, active: true },
    select: { fromNodeId: true, toNodeId: true },
  });
  const nodes = await prisma.knowledgeGraphNode.findMany({
    where: { storeId, status: "active" },
    select: { id: true },
  });

  const adjacency = new Map<string, Set<string>>();
  for (const node of nodes) {
    adjacency.set(node.id, new Set());
  }
  for (const edge of edges) {
    adjacency.get(edge.fromNodeId)?.add(edge.toNodeId);
    adjacency.get(edge.toNodeId)?.add(edge.fromNodeId);
  }

  const visited = new Set<string>();
  let components = 0;
  let disconnected = 0;

  for (const node of nodes) {
    if (visited.has(node.id)) {
      continue;
    }
    components += 1;
    const queue = [node.id];
    visited.add(node.id);
    let size = 0;
    while (queue.length > 0) {
      const current = queue.shift()!;
      size += 1;
      for (const neighbor of adjacency.get(current) ?? []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
    if (size === 1) {
      disconnected += 1;
    }
  }

  return { connectedComponents: components, disconnectedNodes: disconnected };
}

function round(value: number, digits = 4): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
