import { JobPriority, JobType } from "@prisma/client";

import { enqueueJob } from "../../services/job.server";

export type IntelligencePipelineJobStage =
  | "root_cause_generate"
  | "prediction_generate"
  | "experiment_generate"
  | "executive_coo_generate";

/**
 * Schedules the next intelligence pipeline stage without cross-importing domain schedulers.
 * Breaks the executive → root-cause → prediction → experiment cycle.
 */
export async function scheduleIntelligencePipelineJob(input: {
  storeId: string;
  stage: IntelligencePipelineJobStage;
  contextSnapshotId?: string;
  idempotencyKey?: string;
}): Promise<string> {
  const payload =
    input.contextSnapshotId === undefined
      ? {}
      : { contextSnapshotId: input.contextSnapshotId };

  switch (input.stage) {
    case "root_cause_generate": {
      const job = await enqueueJob({
        storeId: input.storeId,
        jobType: JobType.root_cause_generate,
        idempotencyKey:
          input.idempotencyKey ??
          `root-cause:generate:${input.storeId}:${Date.now()}`,
        maxAttempts: 5,
        priority: JobPriority.high,
        payload,
      });
      return job.id;
    }
    case "prediction_generate": {
      const job = await enqueueJob({
        storeId: input.storeId,
        jobType: JobType.prediction_generate,
        idempotencyKey:
          input.idempotencyKey ??
          `prediction:generate:${input.storeId}:${Date.now()}`,
        maxAttempts: 5,
        priority: JobPriority.high,
        payload,
      });
      return job.id;
    }
    case "experiment_generate": {
      const job = await enqueueJob({
        storeId: input.storeId,
        jobType: JobType.experiment_generate,
        idempotencyKey:
          input.idempotencyKey ??
          `experiment:generate:${input.storeId}:${Date.now()}`,
        maxAttempts: 5,
        priority: JobPriority.high,
        payload,
      });
      return job.id;
    }
    case "executive_coo_generate": {
      const job = await enqueueJob({
        storeId: input.storeId,
        jobType: JobType.executive_coo_generate,
        idempotencyKey:
          input.idempotencyKey ??
          `executive:coo:${input.storeId}:${input.contextSnapshotId ?? "latest"}`,
        maxAttempts: 5,
        priority: JobPriority.high,
        payload,
      });
      return job.id;
    }
    default: {
      const exhaustive: never = input.stage;
      throw new Error(`unsupported_pipeline_stage:${exhaustive}`);
    }
  }
}
