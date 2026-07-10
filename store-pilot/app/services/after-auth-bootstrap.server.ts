import { JobPriority, JobType } from "@prisma/client";
import type { Session } from "@shopify/shopify-api";

import prisma from "../db.server";
import { scheduleLearningBootstrapJob } from "../learning/scheduler/learning-bootstrap-scheduler";
import {
  BootstrapSubscriptionError,
  ensureSubscriptionForActiveStore,
} from "./billing.server";
import { enqueueJob } from "./job.server";
import {
  advanceOnboarding,
  getOrCreateStoreOnboarding,
} from "./onboarding.server";
import { ensureOrdersSchedulerActive } from "./orders-scheduler.server";
import { ensureStoreBackfillAfterReinstall } from "./store-backfill.server";
import type { StoreSyncAdminClient } from "./store.server";
import { upsertOwnerFromSession } from "./user.server";

const LOG_PREFIX = "[post-auth-bootstrap]";

type LogLevel = "info" | "error";

function logPostAuth(
  level: LogLevel,
  message: string,
  context: Record<string, unknown>,
): void {
  const payload = { message, ...context };
  if (level === "error") {
    console.error(LOG_PREFIX, payload);
    return;
  }
  console.info(LOG_PREFIX, payload);
}

export async function schedulePostAuthBootstrapJob(storeId: string): Promise<string> {
  const job = await enqueueJob({
    storeId,
    jobType: JobType.onboarding_bootstrap,
    idempotencyKey: `post-auth:bootstrap:${storeId}`,
    maxAttempts: 5,
    priority: JobPriority.critical,
    payload: { source: "after_auth" },
  });

  logPostAuth("info", "Post-auth bootstrap job enqueued", {
    storeId,
    jobId: job.id,
    operation: "post_auth_bootstrap_enqueued",
  });

  return job.id;
}

/**
 * Background continuation of install/reinstall bootstrap.
 * Runs in the worker — never blocks OAuth callback.
 */
export async function runPostAuthBootstrap(input: {
  storeId: string;
  shop: string;
  admin: StoreSyncAdminClient;
}): Promise<void> {
  const store = await prisma.store.findUnique({
    where: { id: input.storeId },
    select: { id: true, active: true, shopifyDomain: true },
  });

  if (!store?.active) {
    logPostAuth("error", "Store not eligible for post-auth bootstrap", {
      storeId: input.storeId,
      shop: input.shop,
      operation: "post_auth_bootstrap_skipped",
      reason: !store ? "store_not_found" : "store_inactive",
    });
    return;
  }

  const session = { shop: input.shop } as Session;

  try {
    await upsertOwnerFromSession(session, input.admin);
  } catch (error) {
    logPostAuth("error", "Owner upsert failed during post-auth bootstrap", {
      storeId: input.storeId,
      shop: input.shop,
      operation: "owner_upsert_failed",
      reason: error instanceof Error ? error.message : "unknown_error",
    });
  }

  try {
    await ensureSubscriptionForActiveStore(store.id);
    await getOrCreateStoreOnboarding(store.id);
    await ensureStoreBackfillAfterReinstall(store.id);
    await ensureOrdersSchedulerActive(store.id);

    await scheduleLearningBootstrapJob({
      storeId: store.id,
      idempotencyKey: `learning:bootstrap:${store.id}`,
    });

    logPostAuth("info", "Store onboarding initialized (background)", {
      storeId: store.id,
      shop: input.shop,
      operation: "onboarding_initialized",
    });

    const advanceResult = await advanceOnboarding({ storeId: store.id });
    logPostAuth("info", "Store onboarding advanced (background)", {
      storeId: store.id,
      shop: input.shop,
      operation: "onboarding_advanced",
      action: advanceResult.action,
      phase: advanceResult.phase,
      jobId: advanceResult.jobId,
    });
  } catch (error) {
    const reason =
      error instanceof BootstrapSubscriptionError
        ? error.reason
        : error instanceof Error
          ? error.message
          : "unknown_error";

    logPostAuth("error", "Post-auth bootstrap failed", {
      storeId: store.id,
      shop: input.shop,
      operation: "post_auth_bootstrap_failed",
      reason,
    });

    throw error;
  }
}
