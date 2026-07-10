import { JobPriority, JobType } from "@prisma/client";

import { enqueueJob } from "../../services/job.server";
import { runMerchantIntelligence } from "../engine/merchant-intelligence-engine";
import type { MerchantIntelligenceResult } from "../shared/types";

export async function scheduleMerchantIntelligenceRefreshJob(input: {
  storeId: string;
  idempotencyKey?: string;
}): Promise<string> {
  const job = await enqueueJob({
    storeId: input.storeId,
    jobType: JobType.merchant_intelligence_refresh,
    idempotencyKey:
      input.idempotencyKey ??
      `merchant-intel:refresh:${input.storeId}:${Date.now()}`,
    maxAttempts: 5,
    priority: JobPriority.high,
    payload: {},
  });
  return job.id;
}

export async function executeMerchantIntelligenceRefreshJob(input: {
  storeId: string;
}): Promise<MerchantIntelligenceResult> {
  return runMerchantIntelligence(input.storeId);
}
