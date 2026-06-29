import type { AIExecutionLogEntry, AIExecutionStatus, AIValidationStatus } from "./ai-types";

export type AILogger = {
  logExecution(entry: AIExecutionLogEntry): void;
};

export class ConsoleAILogger implements AILogger {
  logExecution(entry: AIExecutionLogEntry): void {
    const payload = {
      channel: "ai-platform",
      ...entry,
    };

    if (entry.status === "failure") {
      console.error("[ai-platform]", payload);
      return;
    }

    console.info("[ai-platform]", payload);
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
