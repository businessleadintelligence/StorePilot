import { JobPriority, JobType } from "@prisma/client";

import { scheduleIntelligencePipelineJob } from "../../intelligence/scheduler/pipeline-chain.server";
import { enqueueJob } from "../../services/job.server";
import { runExperimentEngine } from "../engine/experiment-engine";
import type { ExperimentEngineResult } from "../shared/types";

export async function scheduleExperimentGenerateJob(input: {
  storeId: string;
  contextSnapshotId?: string;
  idempotencyKey?: string;
}): Promise<string> {
  const job = await enqueueJob({
    storeId: input.storeId,
    jobType: JobType.experiment_generate,
    idempotencyKey:
      input.idempotencyKey ?? `experiment:generate:${input.storeId}:${Date.now()}`,
    maxAttempts: 5,
    priority: JobPriority.high,
    payload: {
      contextSnapshotId: input.contextSnapshotId,
    },
  });
  return job.id;
}

export async function executeExperimentGenerateJob(input: {
  storeId: string;
  contextSnapshotId?: string;
}): Promise<ExperimentEngineResult> {
  const result = await runExperimentEngine(input.storeId);

  void scheduleIntelligencePipelineJob({
    storeId: input.storeId,
    stage: "executive_coo_generate",
    contextSnapshotId: input.contextSnapshotId,
    idempotencyKey: `executive:coo:after-experiment:${input.storeId}`,
  }).catch(() => undefined);

  return result;
}

export { runExperimentEngine as runExperimentPlannerJob };
