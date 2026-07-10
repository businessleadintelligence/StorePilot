import { JobPriority, JobType } from "@prisma/client";

import { scheduleIntelligencePipelineJob } from "../../intelligence/scheduler/pipeline-chain.server";
import { enqueueJob } from "../../services/job.server";
import { runRootCauseEngine } from "../engine/root-cause-engine";
import type { RootCauseEngineResult } from "../shared/types";

export async function scheduleRootCauseGenerateJob(input: {
  storeId: string;
  contextSnapshotId?: string;
  idempotencyKey?: string;
}): Promise<string> {
  const job = await enqueueJob({
    storeId: input.storeId,
    jobType: JobType.root_cause_generate,
    idempotencyKey:
      input.idempotencyKey ?? `root-cause:generate:${input.storeId}:${Date.now()}`,
    maxAttempts: 5,
    priority: JobPriority.high,
    payload: {
      contextSnapshotId: input.contextSnapshotId,
    },
  });
  return job.id;
}

export async function executeRootCauseGenerateJob(input: {
  storeId: string;
  contextSnapshotId?: string;
}): Promise<RootCauseEngineResult> {
  const result = await runRootCauseEngine(input.storeId);

  void scheduleIntelligencePipelineJob({
    storeId: input.storeId,
    stage: "prediction_generate",
    contextSnapshotId: input.contextSnapshotId,
    idempotencyKey: `prediction:after-root-cause:${input.storeId}`,
  }).catch(() => undefined);

  return result;
}
