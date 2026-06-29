import type { AIAgentId } from "@prisma/client";

import prisma from "../../db.server";
import type { TelemetryRecord, TelemetryWriter } from "./telemetry-writer";

export class PrismaTelemetryWriter implements TelemetryWriter {
  async write(record: TelemetryRecord): Promise<void> {
    await prisma.aiExecutionTelemetry.create({
      data: {
        runId: record.runId,
        storeId: record.storeId,
        merchantId: record.merchantId ?? null,
        agentId: record.agentId as AIAgentId,
        providerId: record.providerId,
        modelId: record.modelId,
        promptId: record.promptId,
        promptVersion: record.promptVersion,
        promptChecksum: record.promptChecksum,
        latencyMs: record.latencyMs,
        promptTokens: record.promptTokens,
        completionTokens: record.completionTokens,
        totalTokens: record.totalTokens,
        estimatedCostUsd: record.estimatedCostUsd,
        retryCount: record.retryCount,
        validationStatus: record.validationStatus as never,
        executionStatus: record.executionStatus as never,
      },
    });
  }
}

export class CompositeTelemetryWriter implements TelemetryWriter {
  constructor(private readonly writers: TelemetryWriter[]) {}

  async write(record: TelemetryRecord): Promise<void> {
    await Promise.all(this.writers.map((writer) => writer.write(record)));
  }
}
