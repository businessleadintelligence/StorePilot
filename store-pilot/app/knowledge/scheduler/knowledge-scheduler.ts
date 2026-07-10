import { JobType, type KnowledgeSyncMode, JobPriority } from "@prisma/client";

import { enqueueJob } from "../../services/job.server";
import { runKnowledgeIngestionPipeline } from "../pipeline/knowledge-pipeline";
import type { KnowledgePipelineInput } from "../shared/types";

export type ScheduleKnowledgeIngestInput = {
  storeId: string;
  shop: string;
  syncMode?: KnowledgeSyncMode;
  idempotencyKey?: string;
  priority?: "low" | "normal" | "high";
};

export async function scheduleKnowledgeIngestJob(
  input: ScheduleKnowledgeIngestInput,
): Promise<string> {
  const syncMode = input.syncMode ?? "initial_import";
  const job = await enqueueJob({
    storeId: input.storeId,
    jobType: JobType.knowledge_ingest,
    idempotencyKey:
      input.idempotencyKey ?? `knowledge:${input.storeId}:${syncMode}:${Date.now()}`,
    maxAttempts: 5,
    priority:
      input.priority === "high"
        ? JobPriority.high
        : input.priority === "low"
          ? JobPriority.low
          : JobPriority.normal,
    payload: {
      shop: input.shop,
      syncMode,
    },
  });
  return job.id;
}

export async function scheduleKnowledgeFactRefresh(
  input: ScheduleKnowledgeIngestInput,
): Promise<string> {
  return scheduleKnowledgeIngestJob({
    ...input,
    syncMode: "fact_refresh",
    idempotencyKey: input.idempotencyKey ?? `knowledge:fact_refresh:${input.storeId}`,
  });
}

export async function scheduleManualKnowledgeRebuild(
  input: ScheduleKnowledgeIngestInput,
): Promise<string> {
  return scheduleKnowledgeIngestJob({
    ...input,
    syncMode: "manual_rebuild",
    idempotencyKey: input.idempotencyKey ?? `knowledge:rebuild:${input.storeId}:${Date.now()}`,
    priority: "high",
  });
}

export async function executeKnowledgeIngestJob(input: {
  storeId: string;
  shop: string;
  syncMode: KnowledgeSyncMode;
  admin?: import("../../services/store.server").StoreSyncAdminClient | null;
  batchSize?: number;
}) {
  const pipelineInput: KnowledgePipelineInput = {
    storeId: input.storeId,
    shop: input.shop,
    syncMode: input.syncMode,
    batchSize: input.batchSize,
    resumeFromCheckpoint: true,
  };
  return runKnowledgeIngestionPipeline(pipelineInput, {
    admin: input.admin ?? null,
    useShopifyCollector: Boolean(input.admin),
  });
}

export async function scheduleIncrementalKnowledgeImport(
  input: ScheduleKnowledgeIngestInput,
): Promise<string> {
  return scheduleKnowledgeIngestJob({
    ...input,
    syncMode: "incremental",
    idempotencyKey:
      input.idempotencyKey ??
      `knowledge:incremental:${input.storeId}:${new Date().toISOString().slice(0, 13)}`,
  });
}

export async function scheduleEvidenceRefresh(
  input: ScheduleKnowledgeIngestInput,
): Promise<string> {
  return scheduleKnowledgeIngestJob({
    ...input,
    syncMode: "evidence_refresh",
    idempotencyKey: input.idempotencyKey ?? `knowledge:evidence_refresh:${input.storeId}`,
  });
}

export async function scheduleWebhookResumeKnowledgeImport(
  input: ScheduleKnowledgeIngestInput & { topic: string; entityId?: string },
): Promise<string> {
  return scheduleKnowledgeIngestJob({
    ...input,
    syncMode: "webhook_resume",
    idempotencyKey:
      input.idempotencyKey ??
      `knowledge:webhook:${input.storeId}:${input.topic}:${input.entityId ?? "all"}`,
    priority: "high",
  });
}
