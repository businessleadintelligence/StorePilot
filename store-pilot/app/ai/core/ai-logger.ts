import { createLogger, generateAiRequestId } from "../../lib/logging/index.server";
import type { AIExecutionLogEntry, AIExecutionStatus, AIValidationStatus } from "./ai-types";

export type AILogger = {
  logExecution(entry: AIExecutionLogEntry): void;
};

export class ConsoleAILogger implements AILogger {
  private readonly logger = createLogger({ component: "ai-platform" });

  logExecution(entry: AIExecutionLogEntry): void {
    const level = entry.status === "failure" ? "error" : "info";

    this.logger[level]("AI execution completed", {
      channel: "ai-platform",
      aiRequestId: generateAiRequestId(),
      ...entry,
    });
  }
}

export function createExecutionLogEntry(input: {
  agentId?: string;
  provider: string;
  model: string;
  promptId?: string;
  promptVersion?: string;
  latencyMs: number;
  estimatedCostUsd: number | null;
  tokens: AIExecutionLogEntry["tokens"];
  status: AIExecutionStatus;
  validationStatus: AIValidationStatus;
  errorCode?: string;
  operation: string;
}): AIExecutionLogEntry {
  return {
    timestamp: new Date().toISOString(),
    agentId: input.agentId,
    provider: input.provider,
    model: input.model,
    promptId: input.promptId,
    promptVersion: input.promptVersion,
    latencyMs: input.latencyMs,
    estimatedCostUsd: input.estimatedCostUsd,
    tokens: input.tokens,
    status: input.status,
    validationStatus: input.validationStatus,
    errorCode: input.errorCode,
    operation: input.operation,
  };
}
