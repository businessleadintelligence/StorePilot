import type { KnowledgeSyncMode } from "@prisma/client";

import prisma from "../../db.server";
import type { CollectorCheckpoint } from "../shared/types";

export async function loadKnowledgeCheckpoint(
  storeId: string,
): Promise<CollectorCheckpoint & { syncMode: KnowledgeSyncMode; status: string }> {
  const row = await prisma.knowledgeSyncCheckpoint.findUnique({ where: { storeId } });
  if (!row) {
    return {
      syncMode: "initial_import",
      status: "idle",
      productCursor: null,
      orderCursor: null,
      inventoryCursor: null,
      collectionCursor: null,
      productsProcessed: 0,
      ordersProcessed: 0,
    };
  }
  return {
    syncMode: row.syncMode,
    status: row.status,
    productCursor: row.productCursor,
    orderCursor: row.orderCursor,
    inventoryCursor: row.inventoryCursor,
    collectionCursor: row.collectionCursor,
    productsProcessed: row.productsProcessed,
    ordersProcessed: row.ordersProcessed,
  };
}

export async function saveKnowledgeCheckpoint(input: {
  storeId: string;
  syncMode: KnowledgeSyncMode;
  status: string;
  checkpoint: CollectorCheckpoint;
  evidenceCreated?: number;
}): Promise<void> {
  await prisma.knowledgeSyncCheckpoint.upsert({
    where: { storeId: input.storeId },
    create: {
      storeId: input.storeId,
      syncMode: input.syncMode,
      status: input.status,
      productCursor: input.checkpoint.productCursor,
      orderCursor: input.checkpoint.orderCursor,
      inventoryCursor: input.checkpoint.inventoryCursor,
      collectionCursor: input.checkpoint.collectionCursor,
      productsProcessed: input.checkpoint.productsProcessed,
      ordersProcessed: input.checkpoint.ordersProcessed,
      evidenceCreated: input.evidenceCreated ?? 0,
      lastSyncAt: new Date(),
    },
    update: {
      syncMode: input.syncMode,
      status: input.status,
      productCursor: input.checkpoint.productCursor,
      orderCursor: input.checkpoint.orderCursor,
      inventoryCursor: input.checkpoint.inventoryCursor,
      collectionCursor: input.checkpoint.collectionCursor,
      productsProcessed: input.checkpoint.productsProcessed,
      ordersProcessed: input.checkpoint.ordersProcessed,
      evidenceCreated: input.evidenceCreated ?? 0,
      lastSyncAt: new Date(),
    },
  });
}

export async function markCheckpointRunning(storeId: string): Promise<void> {
  await prisma.knowledgeSyncCheckpoint.upsert({
    where: { storeId },
    create: { storeId, status: "running" },
    update: { status: "running" },
  });
}

export async function markCheckpointIdle(storeId: string): Promise<void> {
  await prisma.knowledgeSyncCheckpoint.updateMany({
    where: { storeId },
    data: { status: "idle" },
  });
}
