import { JobPriority, JobType } from "@prisma/client";

import { scheduleIntelligencePipelineJob } from "../../intelligence/scheduler/pipeline-chain.server";
import { enqueueJob } from "../../services/job.server";
import { runPredictionEngine } from "../engine/prediction-engine";
import type { PredictionEngineResult } from "../shared/types";

export async function schedulePredictionGenerateJob(input: {
  storeId: string;
  contextSnapshotId?: string;
  idempotencyKey?: string;
}): Promise<string> {
  const job = await enqueueJob({
    storeId: input.storeId,
    jobType: JobType.prediction_generate,
    idempotencyKey:
      input.idempotencyKey ?? `prediction:generate:${input.storeId}:${Date.now()}`,
    maxAttempts: 5,
    priority: JobPriority.high,
    payload: {
      contextSnapshotId: input.contextSnapshotId,
    },
  });
  return job.id;
}

export async function executePredictionGenerateJob(input: {
  storeId: string;
  contextSnapshotId?: string;
}): Promise<PredictionEngineResult> {
  const result = await runPredictionEngine(input.storeId);

  void scheduleIntelligencePipelineJob({
    storeId: input.storeId,
    stage: "experiment_generate",
    contextSnapshotId: input.contextSnapshotId,
    idempotencyKey: `experiment:after-prediction:${input.storeId}`,
  }).catch(() => undefined);

  return result;
}
