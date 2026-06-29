import { randomUUID } from "node:crypto";

import prisma from "../db.server";
import { runWorkerCycle } from "../services/worker.server";

const STORE_ID = "d5e9f90a-5485-483e-96a9-cc2b0f39d8ee";

async function main() {
  const workerResult = await runWorkerCycle(`f310-worker-${randomUUID().slice(0, 8)}`);

  const [onboarding, jobs, jobEvents] = await Promise.all([
    prisma.storeOnboarding.findUnique({
      where: { storeId: STORE_ID },
      include: { currentJob: true },
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

  console.log(
    JSON.stringify(
      {
        workerResult,
        finalOnboarding: onboarding,
        finalJobs: jobs,
        jobEvents,
        verification: {
          ordersPhase: onboarding?.ordersSyncStatus ?? null,
          onboardingStatus: onboarding?.status ?? null,
          blockedReason: onboarding?.blockedReason ?? null,
          blockedMessage: onboarding?.blockedMessage ?? null,
          ordersJobStatus:
            jobs.find((job) => job.jobType === "orders_historical")?.status ?? null,
          ordersBlockedCompletesOnboarding:
            onboarding?.ordersSyncStatus === "blocked"
              ? onboarding?.status === "completed"
              : null,
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
