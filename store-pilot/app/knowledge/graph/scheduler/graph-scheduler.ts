import { JobPriority, JobType } from "@prisma/client";

import { enqueueJob } from "../../../services/job.server";
import { runGraphBuilder, runIncrementalGraphUpdate } from "../builder/graph-builder";
import type { GraphBuildInput } from "../shared/types";

export async function scheduleGraphBuildJob(input: {
  storeId: string;
  incremental?: boolean;
  entityType?: string;
  entityId?: string;
  idempotencyKey?: string;
}): Promise<string> {
  const job = await enqueueJob({
    storeId: input.storeId,
    jobType: input.incremental ? JobType.knowledge_graph_incremental : JobType.knowledge_graph_build,
    idempotencyKey:
      input.idempotencyKey ??
      `graph:${input.incremental ? "incremental" : "build"}:${input.storeId}:${Date.now()}`,
    maxAttempts: 5,
    priority: input.incremental ? JobPriority.high : JobPriority.normal,
    payload: {
      entityType: input.entityType,
      entityId: input.entityId,
    },
  });
  return job.id;
}

export async function executeGraphBuildJob(input: {
  storeId: string;
  incremental?: boolean;
  entityType?: string;
  entityId?: string;
  resumeFromCheckpoint?: boolean;
}) {
  if (input.incremental && input.entityType && input.entityId) {
    return runIncrementalGraphUpdate({
      storeId: input.storeId,
      entityType: input.entityType,
      entityId: input.entityId,
    });
  }
  const buildInput: GraphBuildInput = {
    storeId: input.storeId,
    incremental: input.incremental,
    resumeFromCheckpoint: input.resumeFromCheckpoint ?? true,
    scope:
      input.entityType && input.entityId
        ? { entityType: input.entityType, entityId: input.entityId }
        : undefined,
  };
  return runGraphBuilder(buildInput);
}

export async function scheduleIncrementalGraphUpdate(input: {
  storeId: string;
  entityType: string;
  entityId: string;
  topic?: string;
}): Promise<string> {
  return scheduleGraphBuildJob({
    storeId: input.storeId,
    incremental: true,
    entityType: input.entityType,
    entityId: input.entityId,
    idempotencyKey: `graph:incremental:${input.storeId}:${input.entityType}:${input.entityId}:${input.topic ?? "update"}`,
  });
}
