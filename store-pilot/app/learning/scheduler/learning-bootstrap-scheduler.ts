import { JobPriority, JobType } from "@prisma/client";

import { enqueueJob } from "../../services/job.server";
import type { StoreSyncAdminClient } from "../../services/store.server";
import { runBootstrapIntelligence } from "../bootstrap/bootstrap-orchestrator";

export async function scheduleLearningBootstrapJob(input: {
  storeId: string;
  idempotencyKey?: string;
}): Promise<string> {
  const job = await enqueueJob({
    storeId: input.storeId,
    jobType: JobType.learning_bootstrap,
    idempotencyKey: input.idempotencyKey ?? `learning:bootstrap:${input.storeId}`,
    maxAttempts: 5,
    priority: JobPriority.critical,
    payload: {},
  });
  return job.id;
}

export async function executeLearningBootstrapJob(input: {
  storeId: string;
  admin: StoreSyncAdminClient;
}) {
  return runBootstrapIntelligence(input);
}

export async function bootstrapIntelligenceAfterAuth(input: {
  storeId: string;
  admin: StoreSyncAdminClient;
}) {
  return runBootstrapIntelligence(input);
}
