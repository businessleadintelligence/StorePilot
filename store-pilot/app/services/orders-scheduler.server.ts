import { JobPriority, JobType, OnboardingStatus } from "@prisma/client";

import prisma from "../db.server";
import { enqueueJob } from "./job.server";

/** Minimum spacing between incremental order sync jobs per store. */
export const ORDERS_INCREMENTAL_INTERVAL_MS = 15 * 60 * 1000;

export function buildOrdersIncrementalIdempotencyKey(
  storeId: string,
  slot: Date = new Date(),
): string {
  const bucket = Math.floor(slot.getTime() / ORDERS_INCREMENTAL_INTERVAL_MS);
  return `orders-incremental:${storeId}:${bucket}`;
}

export function nextOrdersIncrementalAvailableAt(
  from: Date = new Date(),
): Date {
  return new Date(from.getTime() + ORDERS_INCREMENTAL_INTERVAL_MS);
}

/**
 * Enqueue a post-onboarding incremental orders sync when the store is active
 * and onboarding has completed. Idempotent within the current time bucket.
 */
export async function scheduleOrdersIncrementalSync(
  storeId: string,
  availableAt: Date = new Date(),
): Promise<{ scheduled: boolean; reason?: string }> {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { active: true },
  });

  if (!store?.active) {
    return { scheduled: false, reason: "store_inactive" };
  }

  const onboarding = await prisma.storeOnboarding.findUnique({
    where: { storeId },
    select: { status: true },
  });

  if (onboarding?.status !== OnboardingStatus.completed) {
    return { scheduled: false, reason: "onboarding_incomplete" };
  }

  await enqueueJob({
    storeId,
    jobType: JobType.orders_incremental,
    idempotencyKey: buildOrdersIncrementalIdempotencyKey(storeId, availableAt),
    priority: JobPriority.normal,
    availableAt,
    maxAttempts: 5,
    payload: { source: "orders_incremental_scheduler" },
  });

  return { scheduled: true };
}

/**
 * Ensure an orders_incremental job is scheduled for active stores with completed onboarding.
 * Safe to call from afterAuth, onboarding completion, and store reactivation.
 */
export async function ensureOrdersSchedulerActive(
  storeId: string,
): Promise<{ scheduled: boolean; reason?: string }> {
  return scheduleOrdersIncrementalSync(storeId);
}
