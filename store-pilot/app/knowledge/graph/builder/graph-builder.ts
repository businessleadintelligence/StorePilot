import prisma from "../../../db.server";
import { createGraphEdgeStore } from "../edges/edge-store";
import { createGraphNodeStore } from "../nodes/node-store";
import {
  createRelationshipEngine,
  type EvidenceGraphInput,
} from "../relationships/relationship-engine";
import { DEFAULT_GRAPH_BATCH_SIZE } from "../shared/constants";
import type { GraphBuildInput, GraphBuildResult } from "../shared/types";
import { indexGraphNode } from "../search/graph-search";
import { computeGraphStatistics, persistGraphStatistics } from "../metrics/graph-metrics";
import { runIntegrityCheck, persistIntegrityReport } from "../integrity/integrity-engine";
import { createGraphSnapshot, bumpGraphVersion } from "../versioning/version-manager";
import { upsertBusinessDnaNode } from "./business-dna";

export { hashSnapshotPayload } from "../shared/snapshot-hash";

export async function runGraphBuilder(input: GraphBuildInput): Promise<GraphBuildResult> {
  const batchSize = input.batchSize ?? DEFAULT_GRAPH_BATCH_SIZE;
  const nodes = createGraphNodeStore();
  const edges = createGraphEdgeStore();
  const relationships = createRelationshipEngine(nodes, edges);

  await prisma.knowledgeGraphMetadata.upsert({
    where: { storeId: input.storeId },
    create: { storeId: input.storeId, builderStatus: "running" },
    update: { builderStatus: "running" },
  });

  const checkpoint = await prisma.knowledgeGraphBuildCheckpoint.upsert({
    where: { storeId: input.storeId },
    create: {
      storeId: input.storeId,
      status: "running",
      scopeEntityType: input.scope?.entityType ?? null,
      scopeEntityId: input.scope?.entityId ?? null,
    },
    update: {
      status: "running",
      scopeEntityType: input.scope?.entityType ?? null,
      scopeEntityId: input.scope?.entityId ?? null,
    },
  });

  const evidenceRows = await prisma.evidence.findMany({
    where: {
      storeId: input.storeId,
      active: true,
      ...(input.scope?.entityType
        ? { entity: input.scope.entityType as never, entityId: input.scope.entityId }
        : {}),
      ...(input.resumeFromCheckpoint && checkpoint.evidenceCursor
        ? { id: { gt: checkpoint.evidenceCursor } }
        : {}),
    },
    orderBy: { id: "asc" },
    take: batchSize,
  });

  let nodesCreated = 0;
  let edgesCreated = 0;

  for (const row of evidenceRows) {
    const evidenceInput: EvidenceGraphInput = {
      id: row.id,
      storeId: row.storeId,
      entity: row.entity,
      entityId: row.entityId,
      factType: row.factType,
      confidence: Number(row.confidence),
      version: row.version,
      freshnessMinutes: row.freshnessMinutes,
      observationCount: row.observationCount,
      sourceId: row.sourceId,
      active: row.active,
      value: row.value,
    };
    const result = await relationships.bindEvidence(evidenceInput);
    nodesCreated += 2;
    edgesCreated += result.edgesCreated;
    await indexGraphNode(result.entityNode);
    await indexGraphNode(result.evidenceNode);
  }

  const stats = await computeGraphStatistics(input.storeId);
  await persistGraphStatistics(input.storeId, stats);
  await upsertBusinessDnaNode(input.storeId, stats);

  const integrity = await runIntegrityCheck(input.storeId);
  await persistIntegrityReport(input.storeId, integrity);

  const lastEvidence = evidenceRows.at(-1);
  const hasMoreWork = evidenceRows.length === batchSize;
  await prisma.knowledgeGraphBuildCheckpoint.update({
    where: { storeId: input.storeId },
    data: {
      status: hasMoreWork ? "running" : "idle",
      evidenceCursor: lastEvidence?.id ?? checkpoint.evidenceCursor,
      evidenceProcessed: checkpoint.evidenceProcessed + evidenceRows.length,
      nodesCreated: checkpoint.nodesCreated + nodesCreated,
      edgesCreated: checkpoint.edgesCreated + edgesCreated,
      lastBuiltAt: new Date(),
    },
  });

  let snapshotVersion: number | undefined;
  if (!hasMoreWork) {
    const version = await bumpGraphVersion(input.storeId, {
      label: input.incremental ? "incremental" : "full_build",
      nodeCount: stats.totalNodes,
      edgeCount: stats.totalEdges,
    });
    await createGraphSnapshot(input.storeId, version.versionNumber, stats);
    snapshotVersion = version.versionNumber;
    await prisma.knowledgeGraphMetadata.update({
      where: { storeId: input.storeId },
      data: {
        builderStatus: "idle",
        lastBuiltAt: new Date(),
        currentVersion: version.versionNumber,
      },
    });
  }

  const nodesUpdated = 0;
  const edgesUpdated = 0;

  return {
    success: evidenceRows.length > 0 || !input.resumeFromCheckpoint,
    hasMoreWork,
    nodesCreated,
    nodesUpdated,
    edgesCreated,
    edgesUpdated,
    evidenceProcessed: evidenceRows.length,
    snapshotVersion,
    integrityScore: integrity.integrityScore,
  };
}

export async function runIncrementalGraphUpdate(input: {
  storeId: string;
  entityType: string;
  entityId: string;
  storeName?: string;
}): Promise<GraphBuildResult> {
  return runGraphBuilder({
    storeId: input.storeId,
    storeName: input.storeName,
    scope: { entityType: input.entityType, entityId: input.entityId },
    incremental: true,
    resumeFromCheckpoint: false,
    batchSize: DEFAULT_GRAPH_BATCH_SIZE,
  });
}
