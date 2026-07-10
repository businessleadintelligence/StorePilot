import { JobPriority, JobType } from "@prisma/client";

import { enqueueJob } from "../../../services/job.server";
import { runQuickWinsGenerator } from "../generator/quick-win-generator";
import type { QuickWinGenerationResult } from "../shared/types";

export async function scheduleQuickWinsGenerateJob(input: {
  storeId: string;
  graphVersion?: number;
  idempotencyKey?: string;
}): Promise<string> {
  const job = await enqueueJob({
    storeId: input.storeId,
    jobType: JobType.quick_wins_generate,
    idempotencyKey:
      input.idempotencyKey ??
      `quick-wins:generate:${input.storeId}:${input.graphVersion ?? "latest"}`,
    maxAttempts: 5,
    priority: JobPriority.high,
    payload: {
      graphVersion: input.graphVersion,
    },
  });
  return job.id;
}

export async function executeQuickWinsGenerateJob(input: {
  storeId: string;
}): Promise<QuickWinGenerationResult> {
  return runQuickWinsGenerator(input.storeId);
}
