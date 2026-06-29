import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STORE_ID = "d5e9f90a-5485-483e-96a9-cc2b0f39d8ee";
const SHOPIFY_DOMAIN = "storepilot-pe9x0muw.myshopify.com";
const RUN_WORKER = process.argv.includes("--run-worker");
const AUDIT_ONLY = process.argv.includes("--audit-only");

async function auditStore() {
  const [store, productCount, orderCount, onboarding, jobs] = await Promise.all([
    prisma.store.findUnique({
      where: { id: STORE_ID },
      select: {
        id: true,
        shopifyDomain: true,
        active: true,
        lastProductsSyncAt: true,
        lastInventorySyncAt: true,
        lastOrdersSyncAt: true,
        historicalImportDone: true,
        historicalOrdersImportDone: true,
      },
    }),
    prisma.product.count({ where: { storeId: STORE_ID } }),
    prisma.order.count({ where: { storeId: STORE_ID } }),
    prisma.storeOnboarding.findUnique({ where: { storeId: STORE_ID } }),
    prisma.syncJob.findMany({
      where: { storeId: STORE_ID },
      select: { id: true, jobType: true, status: true, idempotencyKey: true },
    }),
  ]);

  const safetyReasons = [];

  if (!store) {
    safetyReasons.push("Store not found");
  } else if (store.shopifyDomain !== SHOPIFY_DOMAIN) {
    safetyReasons.push(`Domain mismatch: expected ${SHOPIFY_DOMAIN}`);
  } else if (!store.active) {
    safetyReasons.push("Store is inactive");
  }

  if (productCount <= 0) {
    safetyReasons.push("Product count is zero");
  }

  if (!store?.lastProductsSyncAt) {
    safetyReasons.push("lastProductsSyncAt is null");
  }

  if (!store?.lastInventorySyncAt) {
    safetyReasons.push("lastInventorySyncAt is null");
  }

  if (onboarding) {
    const progressed =
      onboarding.ordersSyncStatus === "running" ||
      onboarding.ordersSyncStatus === "completed" ||
      onboarding.ordersSyncStatus === "blocked";

    if (progressed && jobs.length > 0) {
      safetyReasons.push(
        "Onboarding already advanced with jobs present; manual review required",
      );
    }
  }

  return {
    store,
    productCount,
    orderCount,
    onboarding,
    jobs,
    safeToBackfill: safetyReasons.length === 0,
    safetyReasons,
  };
}

async function createJobEvent(input) {
  await prisma.jobEvent.create({
    data: {
      storeId: input.storeId,
      jobId: input.jobId,
      eventType: input.eventType,
      fromStatus: input.fromStatus ?? null,
      toStatus: input.toStatus ?? null,
      attemptNumber: input.attemptNumber ?? null,
      message: input.message ?? null,
      metadataJson: input.metadataJson ?? undefined,
      actorType: input.actorType ?? "system",
      actorId: input.actorId ?? null,
    },
  });
}

async function enqueueOrdersJob(onboardingRunId) {
  const idempotencyKey = `onboarding:${STORE_ID}:orders`;
  const existing = await prisma.syncJob.findUnique({
    where: { idempotencyKey },
  });

  if (existing) {
    return existing;
  }

  const job = await prisma.syncJob.create({
    data: {
      storeId: STORE_ID,
      jobType: "orders_historical",
      idempotencyKey,
      maxAttempts: 5,
      priority: "critical",
      payload: {
        onboardingRunId,
        phase: "ORDERS",
      },
    },
  });

  await createJobEvent({
    storeId: STORE_ID,
    jobId: job.id,
    eventType: "progress",
    toStatus: "queued",
    message: "Job created",
    metadataJson: { eventKind: "created" },
  });

  return job;
}

async function executeBackfill(audit) {
  const rowsCreated = [];
  const rowsUpdated = [];
  const jobsCreated = [];

  const beforeOnboarding = audit.onboarding;
  const beforeJobs = audit.jobs;

  let onboarding = beforeOnboarding;
  if (!onboarding) {
    onboarding = await prisma.storeOnboarding.create({
      data: {
        storeId: STORE_ID,
        onboardingRunId: randomUUID(),
        status: "not_started",
        productSyncStatus: "not_started",
        inventorySyncStatus: "not_started",
        ordersSyncStatus: "not_started",
      },
    });
    rowsCreated.push({
      table: "store_onboarding",
      storeId: STORE_ID,
      onboardingId: onboarding.id,
    });
  }

  onboarding = await prisma.storeOnboarding.update({
    where: { storeId: STORE_ID },
    data: {
      status: "running",
      startedAt: onboarding.startedAt ?? new Date(),
      productSyncStatus: "completed",
      productSyncCompletedAt: audit.store.lastProductsSyncAt,
      productSyncJobId: null,
      inventorySyncStatus: "completed",
      inventorySyncCompletedAt: audit.store.lastInventorySyncAt,
      inventorySyncJobId: null,
      ordersSyncStatus: "not_started",
      ordersSyncJobId: null,
      ordersSyncCompletedAt: null,
      currentJobId: null,
      blockedReason: null,
      blockedMessage: null,
      failedAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      progressPercent: 66,
      progressLabel: "Syncing inventory complete",
    },
  });

  rowsUpdated.push({
    table: "store_onboarding",
    storeId: STORE_ID,
    onboardingId: onboarding.id,
    productSyncStatus: onboarding.productSyncStatus,
    inventorySyncStatus: onboarding.inventorySyncStatus,
    ordersSyncStatus: onboarding.ordersSyncStatus,
  });

  const ordersJob = await enqueueOrdersJob(onboarding.onboardingRunId);

  if (!beforeJobs.some((job) => job.id === ordersJob.id)) {
    jobsCreated.push({
      table: "sync_jobs",
      jobId: ordersJob.id,
      jobType: ordersJob.jobType,
      status: ordersJob.status,
      idempotencyKey: ordersJob.idempotencyKey,
    });
  }

  const link = await prisma.storeOnboarding.updateMany({
    where: {
      storeId: STORE_ID,
      productSyncStatus: "completed",
      inventorySyncStatus: "completed",
      ordersSyncStatus: "not_started",
    },
    data: {
      status: "running",
      currentJobId: ordersJob.id,
      ordersSyncJobId: ordersJob.id,
      ordersSyncStatus: "running",
      progressPercent: 90,
      progressLabel: "Syncing orders",
    },
  });

  if (link.count === 0) {
    throw new Error("Failed to link orders job during backfill");
  }

  rowsUpdated.push({
    table: "store_onboarding",
    action: "linked_orders_job",
    currentJobId: ordersJob.id,
    ordersSyncJobId: ordersJob.id,
    ordersSyncStatus: "running",
  });

  let workerResult = null;
  if (RUN_WORKER) {
    const { runWorkerCycle } = await import("../app/services/worker.server.ts");
    workerResult = await runWorkerCycle(`f310-backfill-${randomUUID().slice(0, 8)}`);
  }

  return { rowsCreated, rowsUpdated, jobsCreated, workerResult };
}

async function fetchFinalState() {
  const [onboarding, jobs, jobEvents] = await Promise.all([
    prisma.storeOnboarding.findUnique({
      where: { storeId: STORE_ID },
      include: { currentJob: true, ordersSyncJob: true },
    }),
    prisma.syncJob.findMany({
      where: { storeId: STORE_ID },
      orderBy: { createdAt: "asc" },
    }),
    prisma.jobEvent.findMany({
      where: { storeId: STORE_ID },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return { onboarding, jobs, jobEvents };
}

async function main() {
  console.log("=== F.3.10 Phase 1: Read-only audit ===");
  const audit = await auditStore();
  console.log(
    JSON.stringify(
      {
        audit: {
          storeId: STORE_ID,
          shopifyDomain: audit.store?.shopifyDomain ?? null,
          active: audit.store?.active ?? false,
          productCount: audit.productCount,
          orderCount: audit.orderCount,
          lastProductsSyncAt: audit.store?.lastProductsSyncAt ?? null,
          lastInventorySyncAt: audit.store?.lastInventorySyncAt ?? null,
          lastOrdersSyncAt: audit.store?.lastOrdersSyncAt ?? null,
          existingOnboarding: audit.onboarding !== null,
          existingJobCount: audit.jobs.length,
          safeToBackfill: audit.safeToBackfill,
          safetyReasons: audit.safetyReasons,
        },
      },
      null,
      2,
    ),
  );

  if (AUDIT_ONLY || !audit.safeToBackfill) {
    console.log(
      AUDIT_ONLY
        ? "\n=== Audit-only mode: no mutations ==="
        : "\n=== NO-GO: Backfill not executed ===",
    );
    return;
  }

  console.log("\n=== F.3.10 Phase 2: Smart backfill execution ===");
  const execution = await executeBackfill(audit);
  const finalState = await fetchFinalState();

  const ordersJobs = finalState.jobs.filter(
    (job) => job.jobType === "orders_historical",
  );
  const bootstrapJobs = finalState.jobs.filter((job) =>
    ["bootstrap_products", "bootstrap_inventory"].includes(job.jobType),
  );

  console.log(
    JSON.stringify(
      {
        rowsCreated: execution.rowsCreated,
        rowsUpdated: execution.rowsUpdated,
        jobsCreated: execution.jobsCreated,
        workerResult: execution.workerResult,
        finalOnboarding: finalState.onboarding,
        finalJobs: finalState.jobs,
        verification: {
          productsPhase: finalState.onboarding?.productSyncStatus ?? null,
          inventoryPhase: finalState.onboarding?.inventorySyncStatus ?? null,
          ordersPhase: finalState.onboarding?.ordersSyncStatus ?? null,
          onboardingStatus: finalState.onboarding?.status ?? null,
          blockedReason: finalState.onboarding?.blockedReason ?? null,
          blockedMessage: finalState.onboarding?.blockedMessage ?? null,
          ordersJobCount: ordersJobs.length,
          bootstrapJobCount: bootstrapJobs.length,
          exactlyOneOrdersJob: ordersJobs.length === 1,
          noBootstrapJobs: bootstrapJobs.length === 0,
          ordersBlockedCompletesOnboarding:
            finalState.onboarding?.ordersSyncStatus === "blocked"
              ? finalState.onboarding?.status === "completed"
              : null,
        },
        verificationQueries: {
          onboarding:
            "SELECT status, \"productSyncStatus\", \"inventorySyncStatus\", \"ordersSyncStatus\", \"currentJobId\", \"ordersSyncJobId\", \"blockedReason\" FROM store_onboarding WHERE \"storeId\" = 'd5e9f90a-5485-483e-96a9-cc2b0f39d8ee';",
          jobs:
            "SELECT id, \"jobType\", status, \"idempotencyKey\", attempts FROM sync_jobs WHERE \"storeId\" = 'd5e9f90a-5485-483e-96a9-cc2b0f39d8ee' ORDER BY \"createdAt\" ASC;",
          jobEvents:
            "SELECT \"eventType\", \"fromStatus\", \"toStatus\", \"jobId\", message FROM job_events WHERE \"storeId\" = 'd5e9f90a-5485-483e-96a9-cc2b0f39d8ee' ORDER BY \"createdAt\" ASC;",
        },
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
