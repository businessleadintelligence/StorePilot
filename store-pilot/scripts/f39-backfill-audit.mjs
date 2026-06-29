import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const storeCounts = await prisma.$queryRaw`
    SELECT
      COUNT(*) FILTER (WHERE active = true)::int AS active_count,
      COUNT(*) FILTER (WHERE active = false)::int AS inactive_count,
      COUNT(*)::int AS total_count
    FROM stores
  `;

  const stores = await prisma.store.findMany({
    select: {
      id: true,
      shopifyDomain: true,
      active: true,
      historicalImportDone: true,
      historicalOrdersImportDone: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const onboardings = await prisma.storeOnboarding.findMany({
    include: {
      currentJob: {
        select: {
          id: true,
          status: true,
          jobType: true,
        },
      },
      productSyncJob: {
        select: { id: true, status: true, jobType: true },
      },
      inventorySyncJob: {
        select: { id: true, status: true, jobType: true },
      },
      ordersSyncJob: {
        select: { id: true, status: true, jobType: true },
      },
    },
  });

  const syncJobs = await prisma.syncJob.findMany({
    select: {
      id: true,
      storeId: true,
      jobType: true,
      status: true,
      idempotencyKey: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const jobEventCount = await prisma.jobEvent.count();

  const onboardingByStoreId = new Map(
    onboardings.map((row) => [row.storeId, row]),
  );
  const storeById = new Map(stores.map((row) => [row.id, row]));
  const jobById = new Map(syncJobs.map((row) => [row.id, row]));

  const storesWithoutOnboarding = stores.filter(
    (store) => !onboardingByStoreId.has(store.id),
  );
  const onboardingsWithoutStore = onboardings.filter(
    (row) => !storeById.has(row.storeId),
  );
  const duplicateOnboardingStores = await prisma.$queryRaw`
    SELECT "storeId"::text AS store_id, COUNT(*)::int AS row_count
    FROM store_onboarding
    GROUP BY "storeId"
    HAVING COUNT(*) > 1
  `;

  const jobsWithoutStore = syncJobs.filter((job) => !storeById.has(job.storeId));

  const missingReferencedJobs = [];
  for (const onboarding of onboardings) {
    for (const [field, jobId] of [
      ["currentJobId", onboarding.currentJobId],
      ["productSyncJobId", onboarding.productSyncJobId],
      ["inventorySyncJobId", onboarding.inventorySyncJobId],
      ["ordersSyncJobId", onboarding.ordersSyncJobId],
    ]) {
      if (jobId && !jobById.has(jobId)) {
        missingReferencedJobs.push({
          storeId: onboarding.storeId,
          field,
          jobId,
        });
      }
    }
  }

  const completedOnboardingRunningJob = onboardings.filter(
    (row) =>
      row.status === "completed" &&
      row.currentJob?.status === "running",
  );

  const runningOnboardingCompletedJob = onboardings.filter(
    (row) =>
      row.status !== "completed" &&
      row.status !== "failed" &&
      row.currentJob?.status === "completed",
  );

  const perStore = stores.map((store) => {
    const onboarding = onboardingByStoreId.get(store.id) ?? null;
    const storeJobs = syncJobs.filter((job) => job.storeId === store.id);

    return {
      storeId: store.id,
      shopifyDomain: store.shopifyDomain,
      active: store.active,
      historicalImportDone: store.historicalImportDone,
      historicalOrdersImportDone: store.historicalOrdersImportDone,
      storeCreatedAt: store.createdAt,
      onboarding: onboarding
        ? {
            id: onboarding.id,
            status: onboarding.status,
            onboardingRunId: onboarding.onboardingRunId,
            productSyncStatus: onboarding.productSyncStatus,
            inventorySyncStatus: onboarding.inventorySyncStatus,
            ordersSyncStatus: onboarding.ordersSyncStatus,
            currentJobId: onboarding.currentJobId,
            productSyncJobId: onboarding.productSyncJobId,
            inventorySyncJobId: onboarding.inventorySyncJobId,
            ordersSyncJobId: onboarding.ordersSyncJobId,
            currentJobStatus: onboarding.currentJob?.status ?? null,
            productSyncJobStatus: onboarding.productSyncJob?.status ?? null,
            inventorySyncJobStatus: onboarding.inventorySyncJob?.status ?? null,
            ordersSyncJobStatus: onboarding.ordersSyncJob?.status ?? null,
            blockedReason: onboarding.blockedReason,
            progressPercent: onboarding.progressPercent,
            startedAt: onboarding.startedAt,
            completedAt: onboarding.completedAt,
            failedAt: onboarding.failedAt,
          }
        : null,
      jobCount: storeJobs.length,
      jobs: storeJobs,
    };
  });

  console.log(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        storeCounts: storeCounts[0],
        onboardingRowCount: onboardings.length,
        syncJobCount: syncJobs.length,
        jobEventCount,
        duplicateOnboardingStores,
        orphanStates: {
          storesWithoutOnboarding,
          onboardingsWithoutStore: onboardingsWithoutStore.map((row) => ({
            id: row.id,
            storeId: row.storeId,
            status: row.status,
          })),
          jobsWithoutStore,
          missingReferencedJobs,
          completedOnboardingRunningJob: completedOnboardingRunningJob.map((row) => ({
            storeId: row.storeId,
            onboardingStatus: row.status,
            currentJobId: row.currentJobId,
            currentJobStatus: row.currentJob?.status ?? null,
          })),
          runningOnboardingCompletedJob: runningOnboardingCompletedJob.map((row) => ({
            storeId: row.storeId,
            onboardingStatus: row.status,
            currentJobId: row.currentJobId,
            currentJobStatus: row.currentJob?.status ?? null,
            productSyncStatus: row.productSyncStatus,
            inventorySyncStatus: row.inventorySyncStatus,
            ordersSyncStatus: row.ordersSyncStatus,
          })),
        },
        perStore,
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
