import prisma from "../../../db.server";
import { createGraphEdgeStore } from "../edges/edge-store";
import { createGraphNodeStore } from "../nodes/node-store";
import type { GraphIntegrityIssue } from "../shared/types";

export type IntegrityReport = {
  integrityScore: number;
  issues: GraphIntegrityIssue[];
};

export async function runIntegrityCheck(storeId: string): Promise<IntegrityReport> {
  const issues: GraphIntegrityIssue[] = [];
  const nodes = createGraphNodeStore();
  const edges = createGraphEdgeStore();

  const allEdges = await edges.listByStore({ storeId, take: 10_000, activeOnly: false });
  const nodeIds = new Set(
    (await nodes.listByStore({ storeId, take: 10_000 })).map((node) => node.id),
  );

  for (const edge of allEdges) {
    if (!nodeIds.has(edge.fromNodeId) || !nodeIds.has(edge.toNodeId)) {
      issues.push({
        code: "broken_edge",
        message: "Edge references missing node",
        edgeId: edge.id,
        severity: "high",
      });
    }
    if (edge.fromNodeId === edge.toNodeId) {
      issues.push({
        code: "self_loop",
        message: "Edge connects node to itself",
        edgeId: edge.id,
        severity: "medium",
      });
    }
    if (!edge.evidenceId) {
      issues.push({
        code: "missing_evidence",
        message: "Edge missing evidence binding",
        edgeId: edge.id,
        severity: "high",
      });
    }
  }

  const duplicateGroups = await prisma.knowledgeGraphNode.groupBy({
    by: ["nodeType", "canonicalKey"],
    where: { storeId, status: "active" },
    _count: { _all: true },
  });
  for (const duplicate of duplicateGroups) {
    if (duplicate._count._all > 1) {
      issues.push({
        code: "duplicate_node",
        message: `Duplicate node ${duplicate.nodeType}:${duplicate.canonicalKey}`,
        severity: "medium",
      });
    }
  }

  const expiredEvidenceEdges = await prisma.knowledgeGraphEdge.count({
    where: {
      storeId,
      active: true,
      evidence: { active: false },
    },
  });
  if (expiredEvidenceEdges > 0) {
    issues.push({
      code: "expired_evidence",
      message: `${expiredEvidenceEdges} edges reference expired evidence`,
      severity: "medium",
    });
  }

  const orphanNodes = await findOrphanNodes(storeId);
  for (const nodeId of orphanNodes.slice(0, 50)) {
    issues.push({
      code: "orphan_node",
      message: "Node has no active edges",
      nodeId,
      severity: "low",
    });
  }

  const integrityScore = Math.max(0, 1 - issues.length * 0.02);
  return { integrityScore: round(integrityScore), issues };
}

export async function persistIntegrityReport(
  storeId: string,
  report: IntegrityReport,
): Promise<void> {
  await prisma.knowledgeGraphIntegrity.upsert({
    where: { storeId },
    create: {
      storeId,
      integrityScore: report.integrityScore,
      issueCount: report.issues.length,
      issues: report.issues,
      lastCheckedAt: new Date(),
    },
    update: {
      integrityScore: report.integrityScore,
      issueCount: report.issues.length,
      issues: report.issues,
      lastCheckedAt: new Date(),
    },
  });
}

export async function repairGraphIntegrity(storeId: string): Promise<number> {
  let repaired = 0;
  const brokenEdges = await prisma.knowledgeGraphEdge.findMany({
    where: { storeId, active: true, evidenceId: null },
    select: { id: true },
    take: 500,
  });
  if (brokenEdges.length > 0) {
    await prisma.knowledgeGraphEdge.updateMany({
      where: { id: { in: brokenEdges.map((edge) => edge.id) } },
      data: { active: false },
    });
    repaired += brokenEdges.length;
  }

  const expired = await prisma.knowledgeGraphEdge.updateMany({
    where: { storeId, active: true, evidence: { active: false } },
    data: { active: false },
  });
  repaired += expired.count;

  await prisma.knowledgeGraphIntegrity.update({
    where: { storeId },
    data: { lastRepairedAt: new Date() },
  }).catch(() => undefined);

  return repaired;
}

async function findOrphanNodes(storeId: string): Promise<string[]> {
  const nodes = await prisma.knowledgeGraphNode.findMany({
    where: { storeId, status: "active", nodeType: { not: "Store" } },
    select: { id: true },
  });
  const orphans: string[] = [];
  for (const node of nodes) {
    const edgeCount = await prisma.knowledgeGraphEdge.count({
      where: {
        storeId,
        active: true,
        OR: [{ fromNodeId: node.id }, { toNodeId: node.id }],
      },
    });
    if (edgeCount === 0) {
      orphans.push(node.id);
    }
  }
  return orphans;
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
