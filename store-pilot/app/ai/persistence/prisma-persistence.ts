import type { AIAgentId } from "@prisma/client";

import prisma, { runInParallelBatches, withPrismaRetry } from "../../db.server";
import { assertJsonPayloadFreeOfCustomerPii } from "../../lib/json-pii-guard.server";
import type {
  AgentResultRecord,
  AgentRunRecord,
  AIPersistenceRepositories,
  MemoryRecordData,
  PromptVersionRecord,
  RecommendationRecord,
} from "./types";

function mapRun(record: {
  id: string;
  storeId: string;
  merchantId: string | null;
  agentId: AIAgentId;
  status: string;
  validationStatus: string | null;
  subjectKey: string;
  inputFingerprint: string;
  contextJson: unknown;
  promptId: string;
  promptVersion: string;
  promptChecksum: string;
  promptVersionId: string | null;
  providerId: string;
  modelId: string;
  retryCount: number;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: unknown;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: Date;
  completedAt: Date | null;
  createdAt: Date;
}): AgentRunRecord {
  return {
    id: record.id,
    storeId: record.storeId,
    merchantId: record.merchantId,
    agentId: record.agentId,
    status: record.status,
    validationStatus: record.validationStatus,
    subjectKey: record.subjectKey,
    inputFingerprint: record.inputFingerprint,
    contextJson: record.contextJson as Record<string, unknown>,
    promptId: record.promptId,
    promptVersion: record.promptVersion,
    promptChecksum: record.promptChecksum,
    promptVersionId: record.promptVersionId,
    providerId: record.providerId,
    modelId: record.modelId,
    retryCount: record.retryCount,
    latencyMs: record.latencyMs,
    promptTokens: record.promptTokens,
    completionTokens: record.completionTokens,
    totalTokens: record.totalTokens,
    estimatedCostUsd: Number(record.estimatedCostUsd),
    errorCode: record.errorCode,
    errorMessage: record.errorMessage,
    startedAt: record.startedAt.toISOString(),
    completedAt: record.completedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
  };
}

export function createPrismaAIPersistence(): AIPersistenceRepositories {
  return {
    runs: {
      create: async (input) => {
        assertJsonPayloadFreeOfCustomerPii(input.contextJson, "AiAgentRun.contextJson");
        const created = await prisma.aiAgentRun.create({
          data: {
            id: input.id,
            storeId: input.storeId,
            merchantId: input.merchantId ?? null,
            agentId: input.agentId as AIAgentId,
            status: input.status as never,
            validationStatus: (input.validationStatus as never) ?? null,
            subjectKey: input.subjectKey,
            inputFingerprint: input.inputFingerprint,
            contextJson: input.contextJson as object,
            promptId: input.promptId,
            promptVersion: input.promptVersion,
            promptChecksum: input.promptChecksum,
            promptVersionId: input.promptVersionId ?? null,
            providerId: input.providerId,
            modelId: input.modelId,
            retryCount: input.retryCount,
            latencyMs: input.latencyMs,
            promptTokens: input.promptTokens,
            completionTokens: input.completionTokens,
            totalTokens: input.totalTokens,
            estimatedCostUsd: input.estimatedCostUsd,
            errorCode: input.errorCode ?? null,
            errorMessage: input.errorMessage ?? null,
            startedAt: input.startedAt ? new Date(input.startedAt) : undefined,
            completedAt: input.completedAt ? new Date(input.completedAt) : null,
          },
        });
        return mapRun(created);
      },
      update: async (id, patch) => {
        const updated = await prisma.aiAgentRun.update({
          where: { id },
          data: {
            status: patch.status as never,
            validationStatus: patch.validationStatus as never,
            retryCount: patch.retryCount,
            latencyMs: patch.latencyMs,
            promptTokens: patch.promptTokens,
            completionTokens: patch.completionTokens,
            totalTokens: patch.totalTokens,
            estimatedCostUsd: patch.estimatedCostUsd,
            errorCode: patch.errorCode ?? undefined,
            errorMessage: patch.errorMessage ?? undefined,
            completedAt: patch.completedAt ? new Date(patch.completedAt) : undefined,
          },
        });
        return mapRun(updated);
      },
      findById: async (id) => {
        const record = await prisma.aiAgentRun.findUnique({ where: { id } });
        return record ? mapRun(record) : null;
      },
    },
    results: {
      create: async (input) => {
        assertJsonPayloadFreeOfCustomerPii(input.resultJson, "AiAgentResult.resultJson");
        const created = await prisma.aiAgentResult.create({
          data: {
            id: input.id,
            runId: input.runId,
            storeId: input.storeId,
            agentId: input.agentId as AIAgentId,
            subjectKey: input.subjectKey,
            inputFingerprint: input.inputFingerprint,
            resultJson: input.resultJson as object,
            summary: input.summary ?? null,
            priority: input.priority ?? null,
            confidence: input.confidence ?? null,
            isSuccess: input.isSuccess,
            expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
          },
        });

        return {
          id: created.id,
          runId: created.runId,
          storeId: created.storeId,
          agentId: created.agentId,
          subjectKey: created.subjectKey,
          inputFingerprint: created.inputFingerprint,
          resultJson: created.resultJson as Record<string, unknown>,
          summary: created.summary,
          priority: created.priority,
          confidence: created.confidence ? Number(created.confidence) : null,
          isSuccess: created.isSuccess,
          expiresAt: created.expiresAt?.toISOString() ?? null,
          createdAt: created.createdAt.toISOString(),
        };
      },
      findLatestSuccess: async (input) => {
        const record = await prisma.aiAgentResult.findFirst({
          where: {
            storeId: input.storeId,
            agentId: input.agentId as AIAgentId,
            inputFingerprint: input.inputFingerprint,
            isSuccess: true,
          },
          orderBy: { createdAt: "desc" },
        });

        if (!record) {
          return null;
        }

        return {
          id: record.id,
          runId: record.runId,
          storeId: record.storeId,
          agentId: record.agentId,
          subjectKey: record.subjectKey,
          inputFingerprint: record.inputFingerprint,
          resultJson: record.resultJson as Record<string, unknown>,
          summary: record.summary,
          priority: record.priority,
          confidence: record.confidence ? Number(record.confidence) : null,
          isSuccess: record.isSuccess,
          expiresAt: record.expiresAt?.toISOString() ?? null,
          createdAt: record.createdAt.toISOString(),
        };
      },
    },
    promptVersions: {
      upsert: async (input) => {
        const record = await prisma.aiPromptVersion.upsert({
          where: {
            promptId_version: {
              promptId: input.promptId,
              version: input.version,
            },
          },
          create: {
            promptId: input.promptId,
            version: input.version,
            checksum: input.checksum,
            description: input.description,
            expectedSchema: input.expectedSchema,
          },
          update: {},
        });

        return {
          id: record.id,
          promptId: record.promptId,
          version: record.version,
          checksum: record.checksum,
          description: record.description,
          expectedSchema: record.expectedSchema,
          createdAt: record.createdAt.toISOString(),
        } satisfies PromptVersionRecord;
      },
      findByPrompt: async (input) => {
        const record = await prisma.aiPromptVersion.findUnique({
          where: {
            promptId_version: {
              promptId: input.promptId,
              version: input.version,
            },
          },
        });

        if (!record) {
          return null;
        }

        return {
          id: record.id,
          promptId: record.promptId,
          version: record.version,
          checksum: record.checksum,
          description: record.description,
          expectedSchema: record.expectedSchema,
          createdAt: record.createdAt.toISOString(),
        };
      },
    },
    recommendations: {
      upsertMany: async (input) => {
        const upsertOne = async (
          candidate: (typeof input)[number],
        ): Promise<RecommendationRecord> => {
          assertJsonPayloadFreeOfCustomerPii(
            candidate.payloadJson,
            "AiRecommendation.payloadJson",
          );
          const record = await withPrismaRetry(
            () =>
              prisma.aiRecommendation.upsert({
                where: {
                  storeId_stableId: {
                    storeId: candidate.storeId,
                    stableId: candidate.stableId,
                  },
                },
                create: {
                  stableId: candidate.stableId,
                  storeId: candidate.storeId,
                  agentId: candidate.agentId as AIAgentId,
                  runId: candidate.runId,
                  subjectKey: candidate.subjectKey,
                  title: candidate.title,
                  summary: candidate.summary,
                  category: candidate.category,
                  priority: candidate.priority,
                  confidence: candidate.confidence,
                  status: (candidate.status ?? "open") as never,
                  payloadJson: candidate.payloadJson as object,
                },
                update: {
                  runId: candidate.runId,
                  summary: candidate.summary,
                  priority: candidate.priority,
                  confidence: candidate.confidence,
                  payloadJson: candidate.payloadJson as object,
                  lastSeenAt: new Date(),
                },
              }),
            { label: "aiRecommendation.upsert" },
          );

          return {
            id: record.id,
            stableId: record.stableId,
            storeId: record.storeId,
            agentId: record.agentId,
            runId: record.runId,
            subjectKey: record.subjectKey,
            title: record.title,
            summary: record.summary,
            category: record.category,
            priority: record.priority,
            confidence: Number(record.confidence),
            status: record.status,
            payloadJson: record.payloadJson as Record<string, unknown>,
            firstSeenAt: record.firstSeenAt.toISOString(),
            lastSeenAt: record.lastSeenAt.toISOString(),
            statusChangedAt: record.statusChangedAt.toISOString(),
            createdAt: record.createdAt.toISOString(),
            updatedAt: record.updatedAt.toISOString(),
          };
        };

        return runInParallelBatches(input, 5, upsertOne);
      },
      updateStatus: async (input) => {
        try {
          const record = await prisma.aiRecommendation.update({
            where: {
              storeId_stableId: {
                storeId: input.storeId,
                stableId: input.stableId,
              },
            },
            data: {
              status: input.status as never,
              statusChangedAt: new Date(),
            },
          });

          return {
            id: record.id,
            stableId: record.stableId,
            storeId: record.storeId,
            agentId: record.agentId,
            runId: record.runId,
            subjectKey: record.subjectKey,
            title: record.title,
            summary: record.summary,
            category: record.category,
            priority: record.priority,
            confidence: Number(record.confidence),
            status: record.status,
            payloadJson: record.payloadJson as Record<string, unknown>,
            firstSeenAt: record.firstSeenAt.toISOString(),
            lastSeenAt: record.lastSeenAt.toISOString(),
            statusChangedAt: record.statusChangedAt.toISOString(),
            createdAt: record.createdAt.toISOString(),
            updatedAt: record.updatedAt.toISOString(),
          };
        } catch {
          return null;
        }
      },
      listBySubject: async (input) => {
        const records = await prisma.aiRecommendation.findMany({
          where: {
            storeId: input.storeId,
            subjectKey: input.subjectKey,
            ...(input.statuses ? { status: { in: input.statuses as never[] } } : {}),
          },
        });

        return records.map((record) => ({
          id: record.id,
          stableId: record.stableId,
          storeId: record.storeId,
          agentId: record.agentId,
          runId: record.runId,
          subjectKey: record.subjectKey,
          title: record.title,
          summary: record.summary,
          category: record.category,
          priority: record.priority,
          confidence: Number(record.confidence),
          status: record.status,
          payloadJson: record.payloadJson as Record<string, unknown>,
          firstSeenAt: record.firstSeenAt.toISOString(),
          lastSeenAt: record.lastSeenAt.toISOString(),
          statusChangedAt: record.statusChangedAt.toISOString(),
          createdAt: record.createdAt.toISOString(),
          updatedAt: record.updatedAt.toISOString(),
        }));
      },
    },
    memory: {
      upsert: async (input) => {
        assertJsonPayloadFreeOfCustomerPii(input.payloadJson, "AiMemoryRecord.payloadJson");
        const record = input.id
          ? await prisma.aiMemoryRecord.update({
              where: { id: input.id },
              data: {
                scope: input.scope as never,
                subjectKey: input.subjectKey,
                payloadJson: input.payloadJson as object,
                expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
              },
            })
          : await prisma.aiMemoryRecord.create({
              data: {
                storeId: input.storeId,
                scope: input.scope as never,
                subjectKey: input.subjectKey,
                payloadJson: input.payloadJson as object,
                expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
              },
            });

        return {
          id: record.id,
          storeId: record.storeId,
          scope: record.scope,
          subjectKey: record.subjectKey,
          payloadJson: record.payloadJson as Record<string, unknown>,
          createdAt: record.createdAt.toISOString(),
          updatedAt: record.updatedAt.toISOString(),
          expiresAt: record.expiresAt?.toISOString() ?? null,
        } satisfies MemoryRecordData;
      },
      list: async (input) => {
        const records = await prisma.aiMemoryRecord.findMany({
          where: {
            storeId: input.storeId,
            scope: input.scope as never,
            ...(input.subjectKey ? { subjectKey: input.subjectKey } : {}),
          },
        });

        return records.map((record) => ({
          id: record.id,
          storeId: record.storeId,
          scope: record.scope,
          subjectKey: record.subjectKey,
          payloadJson: record.payloadJson as Record<string, unknown>,
          createdAt: record.createdAt.toISOString(),
          updatedAt: record.updatedAt.toISOString(),
          expiresAt: record.expiresAt?.toISOString() ?? null,
        }));
      },
    },
    cache: {
      lookup: async (input) => {
        const entry = await prisma.aiResultCacheEntry.findUnique({
          where: {
            storeId_agentId_subjectKey_inputFingerprint: {
              storeId: input.storeId,
              agentId: input.agentId as AIAgentId,
              subjectKey: input.subjectKey,
              inputFingerprint: input.inputFingerprint,
            },
          },
          include: { result: true },
        });

        if (!entry) {
          return { result: null, runId: null };
        }

        if (entry.validUntil && entry.validUntil.getTime() <= Date.now()) {
          return { result: null, runId: null };
        }

        return {
          result: {
            id: entry.result.id,
            runId: entry.result.runId,
            storeId: entry.result.storeId,
            agentId: entry.result.agentId,
            subjectKey: entry.result.subjectKey,
            inputFingerprint: entry.result.inputFingerprint,
            resultJson: entry.result.resultJson as Record<string, unknown>,
            summary: entry.result.summary,
            priority: entry.result.priority,
            confidence: entry.result.confidence ? Number(entry.result.confidence) : null,
            isSuccess: entry.result.isSuccess,
            expiresAt: entry.result.expiresAt?.toISOString() ?? null,
            createdAt: entry.result.createdAt.toISOString(),
          } satisfies AgentResultRecord,
          runId: entry.result.runId,
        };
      },
      store: async (input) => {
        await prisma.aiResultCacheEntry.upsert({
          where: {
            storeId_agentId_subjectKey_inputFingerprint: {
              storeId: input.storeId,
              agentId: input.agentId as AIAgentId,
              subjectKey: input.subjectKey,
              inputFingerprint: input.inputFingerprint,
            },
          },
          create: {
            storeId: input.storeId,
            agentId: input.agentId as AIAgentId,
            subjectKey: input.subjectKey,
            inputFingerprint: input.inputFingerprint,
            resultId: input.resultId,
            validUntil: input.validUntil ?? null,
          },
          update: {
            resultId: input.resultId,
            validUntil: input.validUntil ?? null,
          },
        });
      },
    },
  };
}
