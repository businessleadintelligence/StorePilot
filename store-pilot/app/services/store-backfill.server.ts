import { JobPriority, JobType, OnboardingStatus } from "@prisma/client";

import prisma from "../db.server";
import { enqueueJob } from "./job.server";

/** Re-sync threshold after reinstall when last sync is older than this. */
export const BACKFILL_STALE_MS = 24 * 60 * 60 * 1000;

export type StoreBackfillJob = {
  jobType: JobType;
  jobId: string;
};

export type StoreBackfillResult = {
  enqueued: StoreBackfillJob[];
  skipped: string[];
};

function buildBackfillIdempotencyKey(
  storeId: string,
  suffix: string,
  bucket: string,
): string {
  return `backfill:${storeId}:${suffix}:${bucket}`;
}

/**
 * After reinstall, enqueue catch-up sync jobs when onboarding previously completed
 * and store sync timestamps indicate stale or missing data.
 */
export async function ensureStoreBackfillAfterReinstall(
  storeId: string,
): Promise<StoreBackfillResult> {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: {
      active: true,
      lastProductsSyncAt: true,
      lastInventorySyncAt: true,
      lastOrdersSyncAt: true,
      historicalOrdersImportDone: true,
      lastAuthenticatedAt: true,
    },
  });

  if (!store?.active) {
    return { enqueued: [], skipped: ["store_inactive"] };
  }

  const onboarding = await prisma.storeOnboarding.findUnique({
    where: { storeId },
    select: { status: true },
  });

  if (onboarding?.status !== OnboardingStatus.completed) {
    return { enqueued: [], skipped: ["onboarding_not_completed"] };
  }

  const now = Date.now();
  const bucket =
    store.lastAuthenticatedAt?.toISOString().slice(0, 19) ??
    new Date().toISOString().slice(0, 19);
  const result: StoreBackfillResult = { enqueued: [], skipped: [] };

  const needsProducts =
    !store.lastProductsSyncAt ||
    now - store.lastProductsSyncAt.getTime() > BACKFILL_STALE_MS;

  if (needsProducts) {
    const job = await enqueueJob({
      storeId,
      jobType: JobType.bootstrap_products,
      idempotencyKey: buildBackfillIdempotencyKey(storeId, "products", bucket),
      maxAttempts: 5,
      priority: JobPriority.high,
      payload: { source: "reinstall_backfill" },
    });
    result.enqueued.push({ jobType: job.jobType, jobId: job.id });
  } else {
    result.skipped.push("products_fresh");
  }

  const needsInventory =
    !store.lastInventorySyncAt ||
    now - store.lastInventorySyncAt.getTime() > BACKFILL_STALE_MS;

  if (needsInventory) {
    const job = await enqueueJob({
      storeId,
      jobType: JobType.bootstrap_inventory,
      idempotencyKey: buildBackfillIdempotencyKey(storeId, "inventory", bucket),
      maxAttempts: 5,
      priority: JobPriority.high,
      payload: { source: "reinstall_backfill" },
    });
    result.enqueued.push({ jobType: job.jobType, jobId: job.id });
  } else {
    result.skipped.push("inventory_fresh");
  }

  const needsOrders =
    !store.historicalOrdersImportDone ||
    !store.lastOrdersSyncAt ||
    now - store.lastOrdersSyncAt.getTime() > BACKFILL_STALE_MS;

  if (needsOrders) {
    const jobType = store.historicalOrdersImportDone
      ? JobType.orders_incremental
      : JobType.orders_historical;
    const job = await enqueueJob({
      storeId,
      jobType,
      idempotencyKey: buildBackfillIdempotencyKey(storeId, "orders", bucket),
      maxAttempts: 5,
      priority: JobPriority.high,
      payload: { source: "reinstall_backfill" },
    });
    result.enqueued.push({ jobType: job.jobType, jobId: job.id });
  } else {
    result.skipped.push("orders_fresh");
  }

  console.info("[store-backfill]", {
    message: "Reinstall backfill evaluated",
    storeId,
    operation: "reinstall_backfill",
    enqueued: result.enqueued.length,
    skipped: result.skipped,
  });

  return result;
}
