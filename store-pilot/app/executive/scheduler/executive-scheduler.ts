import { JobPriority, JobType } from "@prisma/client";

import { enqueueJob } from "../../services/job.server";
import { scheduleIntelligencePipelineJob } from "../../intelligence/scheduler/pipeline-chain.server";
import { runExecutiveDecisionEngine } from "../decision-engine/decision-engine";
import { runExecutiveCoo } from "../coo/coo-service";
import { scheduleMerchantIntelligenceRefreshJob } from "../../merchant-intelligence/scheduler/merchant-intelligence-scheduler";
import type { ExecutiveDecisionEngineResult } from "../shared/types";

export async function scheduleExecutiveDecisionJob(input: {
  storeId: string;
  idempotencyKey?: string;
}): Promise<string> {
  const job = await enqueueJob({
    storeId: input.storeId,
    jobType: JobType.executive_decision_generate,
    idempotencyKey:
      input.idempotencyKey ?? `executive:decision:${input.storeId}:${Date.now()}`,
    maxAttempts: 5,
    priority: JobPriority.high,
    payload: {},
  });
  return job.id;
}

export async function scheduleExecutiveCooJob(input: {
  storeId: string;
  contextSnapshotId?: string;
  idempotencyKey?: string;
}): Promise<string> {
  const job = await enqueueJob({
    storeId: input.storeId,
    jobType: JobType.executive_coo_generate,
    idempotencyKey:
      input.idempotencyKey ?? `executive:coo:${input.storeId}:${input.contextSnapshotId ?? "latest"}`,
    maxAttempts: 5,
    priority: JobPriority.high,
    payload: {
      contextSnapshotId: input.contextSnapshotId,
    },
  });
  return job.id;
}

export async function executeExecutiveDecisionJob(input: {
  storeId: string;
}): Promise<ExecutiveDecisionEngineResult> {
  const result = await runExecutiveDecisionEngine(input.storeId);

  void scheduleIntelligencePipelineJob({
    storeId: input.storeId,
    stage: "root_cause_generate",
    contextSnapshotId: result.contextSnapshotId,
    idempotencyKey: `root-cause:after-decision:${input.storeId}`,
  }).catch(() => undefined);

  return result;
}

export async function executeExecutiveCooGenerateJob(input: {
  storeId: string;
  contextSnapshotId?: string;
}): Promise<void> {
  await runExecutiveCoo({
    storeId: input.storeId,
    contextSnapshotId: input.contextSnapshotId,
  });

  void scheduleMerchantIntelligenceRefreshJob({
    storeId: input.storeId,
    idempotencyKey: `merchant-intel:after-coo:${input.storeId}`,
  }).catch(() => undefined);
}
