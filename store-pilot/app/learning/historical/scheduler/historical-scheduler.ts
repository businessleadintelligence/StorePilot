import { JobPriority, JobType } from "@prisma/client";

import { enqueueJob } from "../../../services/job.server";
import { runHistoricalIntelligenceEngine } from "../historical-intelligence/historical-intelligence-engine";
import type { HistoricalIntelligenceInput, HistoricalIntelligenceResult } from "../shared/types";

export async function scheduleHistoricalIntelligenceJob(input: {
  storeId: string;
  graphVersion?: number;
  snapshotVersion?: number;
  idempotencyKey?: string;
}): Promise<string> {
  const job = await enqueueJob({
    storeId: input.storeId,
    jobType: JobType.historical_intelligence,
    idempotencyKey:
      input.idempotencyKey ??
      `historical:intelligence:${input.storeId}:${input.graphVersion ?? "latest"}`,
    maxAttempts: 5,
    priority: JobPriority.high,
    payload: {
      graphVersion: input.graphVersion,
      snapshotVersion: input.snapshotVersion,
    },
  });
  return job.id;
}

export async function executeHistoricalIntelligenceJob(input: {
  storeId: string;
  graphVersion?: number;
  snapshotVersion?: number;
}): Promise<HistoricalIntelligenceResult> {
  const engineInput: HistoricalIntelligenceInput = {
    storeId: input.storeId,
    graphVersion: input.graphVersion,
    snapshotVersion: input.snapshotVersion,
  };
  return runHistoricalIntelligenceEngine(engineInput);
}
