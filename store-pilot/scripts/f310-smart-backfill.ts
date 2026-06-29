import { randomUUID } from "node:crypto";

import prisma from "../app/db.server";
import { advanceOnboarding, getOrCreateStoreOnboarding } from "../app/services/onboarding.server";
import { runWorkerCycle } from "../app/services/worker.server";

const STORE_ID = "d5e9f90a-5485-483e-96a9-cc2b0f39d8ee";
const SHOPIFY_DOMAIN = "storepilot-pe9x0muw.myshopify.com";
const RUN_WORKER = process.argv.includes("--run-worker");

type AuditResult = {
  storeId: string;
  shopifyDomain: string;
  active: boolean;
  productCount: number;
  orderCount: number;
  lastProductsSyncAt: Date | null;
  lastInventorySyncAt: Date | null;
  lastOrdersSyncAt: Date | null;
  historicalImportDone: boolean;
  historicalOrdersImportDone: boolean;
  existingOnboarding: boolean;
  existingOnboardingStatus: string | null;
  existingJobCount: number;
  existingOrdersJobs: number;
  safeToBackfill: boolean;
  safetyReasons: string[];
};

async function auditStore(): Promise<AuditResult> {
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

  const safetyReasons: string[] = [];

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
    const terminalOrRunningOrders =
      onboarding.ordersSyncStatus === "running" ||
      onboarding.ordersSyncStatus === "completed" ||
      onboarding.ordersSyncStatus === "blocked";

    if (terminalOrRunningOrders && jobs.length > 0) {
      safetyReasons.push(
        "Onboarding already advanced past bootstrap; manual review required",
      );
    }
  }

  const existingOrdersJobs = jobs.filter(
    (job) => job.jobType === "orders_historical",
  ).length;

  return {
    storeId: STORE_ID,
    shopifyDomain: store?.shopifyDomain ?? SHOPIFY_DOMAIN,
    active: store?.active ?? false,
    productCount,
    orderCount,
    lastProductsSyncAt: store?.lastProductsSyncAt ?? null,
    lastInventorySyncAt: store?.lastInventorySyncAt ?? null,
    lastOrdersSyncAt: store?.lastOrdersSyncAt ?? null,
    historicalImportDone: store?.historicalImportDone ?? false,
    historicalOrdersImportDone: store?.historicalOrdersImportDone ?? false,
    existingOnboarding: onboarding !== null,
    existingOnboardingStatus: onboarding?.status ?? null,
    existingJobCount: jobs.length,
    existingOrdersJobs,
    safeToBackfill: safetyReasons.length === 0,
    safetyReasons,
  };
}

async function fetchFinalState() {
  const [onboarding, jobs, jobEvents] = await Promise.all([
    prisma.storeOnboarding.findUnique({
      where: { storeId: STORE_ID },
      include: {
        currentJob: true,
        ordersSyncJob: true,
      },
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

async function executeBackfill(audit: AuditResult) {
  const rowsCreated: Array<Record<string, unknown>> = [];
  const rowsUpdated: Array<Record<string, unknown>> = [];
  const jobsCreated: Array<Record<string, unknown>> = [];

  const beforeOnboarding = await prisma.storeOnboarding.findUnique({
    where: { storeId: STORE_ID },
  });
  const beforeJobs = await prisma.syncJob.findMany({
    where: { storeId: STORE_ID },
  });

  const createdSummary = await getOrCreateStoreOnboarding(STORE_ID);
  if (!beforeOnboarding) {
    rowsCreated.push({
      table: "store_onboarding",
      storeId: STORE_ID,
      onboardingId: createdSummary.id,
    });
  }

  const updatedOnboarding = await prisma.storeOnboarding.update({
    where: { storeId: STORE_ID },
    data: {
      status: "running",
      startedAt: beforeOnboarding?.startedAt ?? new Date(),
      productSyncStatus: "completed",
      productSyncCompletedAt: audit.lastProductsSyncAt,
      productSyncJobId: null,
      inventorySyncStatus: "completed",
      inventorySyncCompletedAt: audit.lastInventorySyncAt,
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
    onboardingId: updatedOnboarding.id,
    productSyncStatus: updatedOnboarding.productSyncStatus,
    inventorySyncStatus: updatedOnboarding.inventorySyncStatus,
    ordersSyncStatus: updatedOnboarding.ordersSyncStatus,
  });

  const advanceResult = await advanceOnboarding({ storeId: STORE_ID });

  const afterJobs = await prisma.syncJob.findMany({
    where: { storeId: STORE_ID },
    orderBy: { createdAt: "asc" },
  });

  for (const job of afterJobs) {
    if (!beforeJobs.some((existing) => existing.id === job.id)) {
      jobsCreated.push({
        table: "sync_jobs",
        jobId: job.id,
        jobType: job.jobType,
        status: job.status,
        idempotencyKey: job.idempotencyKey,
      });
    }
  }

  let workerResult: Awaited<ReturnType<typeof runWorkerCycle>> | null = null;
  if (RUN_WORKER) {
    workerResult = await runWorkerCycle(`f310-backfill-${randomUUID().slice(0, 8)}`);
  }

  return {
    advanceResult,
    rowsCreated,
    rowsUpdated,
    jobsCreated,
    workerResult,
  };
}

async function main() {
  console.log("=== F.3.10 Phase 1: Read-only audit ===");
  const audit = await auditStore();
  console.log(JSON.stringify({ audit }, null, 2));

  if (!audit.safeToBackfill) {
    console.log("\n=== NO-GO: Backfill not executed ===");
    console.log(JSON.stringify({ reasons: audit.safetyReasons }, null, 2));
    return;
  }

  console.log("\n=== F.3.10 Phase 2: Smart backfill execution ===");
  const execution = await executeBackfill(audit);

  console.log("\n=== F.3.10 Phase 3: Final verification ===");
  const finalState = await fetchFinalState();

  const ordersJobs = finalState.jobs.filter(
    (job) => job.jobType === "orders_historical",
  );
  const bootstrapJobs = finalState.jobs.filter((job) =>
    ["bootstrap_products", "bootstrap_inventory"].includes(job.jobType),
  );

  const verification = {
    productsPhase: finalState.onboarding?.productSyncStatus ?? null,
    inventoryPhase: finalState.onboarding?.inventorySyncStatus ?? null,
    ordersPhase: finalState.onboarding?.ordersSyncStatus ?? null,
    onboardingStatus: finalState.onboarding?.status ?? null,
    blockedReason: finalState.onboarding?.blockedReason ?? null,
    blockedMessage: finalState.onboarding?.blockedMessage ?? null,
    currentJobId: finalState.onboarding?.currentJobId ?? null,
    currentJobType: finalState.onboarding?.currentJob?.jobType ?? null,
    currentJobStatus: finalState.onboarding?.currentJob?.status ?? null,
    ordersJobCount: ordersJobs.length,
    bootstrapJobCount: bootstrapJobs.length,
    totalJobCount: finalState.jobs.length,
    jobEventCount: finalState.jobEvents.length,
    expectedOrdersRunning:
      finalState.onboarding?.productSyncStatus === "completed" &&
      finalState.onboarding?.inventorySyncStatus === "completed" &&
      (finalState.onboarding?.ordersSyncStatus === "running" ||
        finalState.onboarding?.ordersSyncStatus === "blocked" ||
        finalState.onboarding?.ordersSyncStatus === "completed"),
    exactlyOneOrdersJob: ordersJobs.length === 1,
    noBootstrapJobs: bootstrapJobs.length === 0,
    ordersBlockedCompletesOnboarding:
      finalState.onboarding?.ordersSyncStatus === "blocked"
        ? finalState.onboarding?.status === "completed"
        : null,
  };

  console.log(
    JSON.stringify(
      {
        rowsCreated: execution.rowsCreated,
        rowsUpdated: execution.rowsUpdated,
        jobsCreated: execution.jobsCreated,
        advanceResult: execution.advanceResult,
        workerResult: execution.workerResult,
        finalOnboarding: finalState.onboarding,
        finalJobs: finalState.jobs,
        verification,
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
