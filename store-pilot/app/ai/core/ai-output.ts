import type { z } from "zod";

import { AIPlatformError } from "./ai-errors";
import type { AgentRunResult, AIValidationStatus } from "./ai-types";

export type ValidatedStructuredOutput<TOutput> = {
  data: TOutput;
  validationStatus: Extract<AIValidationStatus, "valid">;
};

export function validateStructuredOutput<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  payload: unknown,
): ValidatedStructuredOutput<z.infer<TSchema>> {
  const parsed = schema.safeParse(payload);

  if (!parsed.success) {
    throw AIPlatformError.schemaValidation(
      "Structured output failed schema validation",
      parsed.error,
    );
  }

  return {
    data: parsed.data,
    validationStatus: "valid",
  };
}

export function createAgentRunResult<TOutput>(input: {
  agentId: string;
  output: TOutput;
  provider: string;
  model: string;
  promptId: string;
  promptVersion: string;
  latencyMs: number;
  estimatedCostUsd: number | null;
  tokens: AgentRunResult<TOutput>["tokens"];
  validationStatus?: AIValidationStatus;
}): AgentRunResult<TOutput> {
  return {
    agentId: input.agentId,
    output: input.output,
    provider: input.provider,
    model: input.model,
    promptId: input.promptId,
    promptVersion: input.promptVersion,
    latencyMs: input.latencyMs,
    estimatedCostUsd: input.estimatedCostUsd,
    tokens: input.tokens,
    validationStatus: input.validationStatus ?? "valid",
  };
}

export type StandardAgentOutputMeta = {
  confidence: number;
  reasoning: string;
};

export function assertConfidenceRange(confidence: number, field = "confidence"): void {
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw AIPlatformError.businessRuleValidation(
      `${field} must be a number between 0 and 1`,
    );
  }
}

export function assertPriorityRange(priority: number, field = "priority"): void {
  if (!Number.isFinite(priority) || priority < 1 || priority > 5) {
    throw AIPlatformError.businessRuleValidation(
      `${field} must be a number between 1 and 5`,
    );
  }
}
