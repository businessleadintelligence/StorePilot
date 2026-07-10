import type { Prisma } from "@prisma/client";

import prisma from "../../../db.server";
import { assertJsonPayloadFreeOfCustomerPii } from "../../../lib/json-pii-guard.server";
import { hashSnapshotPayload } from "../shared/snapshot-hash";
import { createGraphEdgeStore } from "../edges/edge-store";
import { createGraphNodeStore } from "../nodes/node-store";
import type { GraphSnapshotDiff, GraphStatisticsSnapshot } from "../shared/types";

export async function bumpGraphVersion(
  storeId: string,
  input: { label: string; nodeCount: number; edgeCount: number; description?: string },
): Promise<{ versionNumber: number }> {
  const metadata = await prisma.knowledgeGraphMetadata.upsert({
    where: { storeId },
    create: { storeId, currentVersion: 1 },
    update: {},
  });
  const versionNumber = metadata.currentVersion + 1;
  await prisma.knowledgeGraphVersion.create({
    data: {
      storeId,
      versionNumber,
      label: input.label,
      description: input.description ?? null,
      nodeCount: input.nodeCount,
      edgeCount: input.edgeCount,
    },
  });
  await prisma.knowledgeGraphMetadata.update({
    where: { storeId },
    data: { currentVersion: versionNumber },
  });
  return { versionNumber };
}

export async function createGraphSnapshot(
  storeId: string,
  versionNumber: number,
  metrics: GraphStatisticsSnapshot,
): Promise<string> {
  const nodes = createGraphNodeStore();
  const edges = createGraphEdgeStore();
  const nodeSnapshot = await nodes.listByStore({ storeId, take: 10_000 });
  const edgeSnapshot = await edges.listByStore({ storeId, take: 20_000 });
  const snapshotHash = hashSnapshotPayload({ nodeSnapshot, edgeSnapshot, metrics });
  const snapshotPayload = { nodeSnapshot, edgeSnapshot, metrics };
  assertJsonPayloadFreeOfCustomerPii(snapshotPayload, "KnowledgeGraphSnapshot");
  const row = await prisma.knowledgeGraphSnapshot.create({
    data: {
      storeId,
      versionNumber,
      snapshotHash,
      nodeSnapshot: nodeSnapshot as unknown as Prisma.InputJsonValue,
      edgeSnapshot: edgeSnapshot as unknown as Prisma.InputJsonValue,
      metricsSnapshot: metrics as unknown as Prisma.InputJsonValue,
      immutable: true,
    },
  });
  return row.id;
}

export async function diffGraphSnapshots(input: {
  storeId: string;
  fromVersion: number;
  toVersion: number;
}): Promise<GraphSnapshotDiff> {
  const [from, to] = await Promise.all([
    prisma.knowledgeGraphSnapshot.findFirst({
      where: { storeId: input.storeId, versionNumber: input.fromVersion },
    }),
    prisma.knowledgeGraphSnapshot.findFirst({
      where: { storeId: input.storeId, versionNumber: input.toVersion },
    }),
  ]);
  if (!from || !to) {
    return {
      nodesAdded: 0,
      nodesRemoved: 0,
      edgesAdded: 0,
      edgesRemoved: 0,
      fromVersion: input.fromVersion,
      toVersion: input.toVersion,
    };
  }
  const fromNodeIds = new Set(
    (from.nodeSnapshot as Array<{ id: string }>).map((node) => node.id),
  );
  const toNodeIds = new Set(
    (to.nodeSnapshot as Array<{ id: string }>).map((node) => node.id),
  );
  const fromEdgeIds = new Set(
    (from.edgeSnapshot as Array<{ id: string }>).map((edge) => edge.id),
  );
  const toEdgeIds = new Set(
    (to.edgeSnapshot as Array<{ id: string }>).map((edge) => edge.id),
  );

  return {
    nodesAdded: [...toNodeIds].filter((id) => !fromNodeIds.has(id)).length,
    nodesRemoved: [...fromNodeIds].filter((id) => !toNodeIds.has(id)).length,
    edgesAdded: [...toEdgeIds].filter((id) => !fromEdgeIds.has(id)).length,
    edgesRemoved: [...fromEdgeIds].filter((id) => !toEdgeIds.has(id)).length,
    fromVersion: input.fromVersion,
    toVersion: input.toVersion,
  };
}

export async function getCurrentGraphVersion(storeId: string): Promise<number> {
  const metadata = await prisma.knowledgeGraphMetadata.findUnique({ where: { storeId } });
  return metadata?.currentVersion ?? 1;
}
