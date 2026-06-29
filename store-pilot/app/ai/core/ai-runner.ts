import type { z } from "zod";

import { toRequestConfig, type AIConfig } from "./ai-config";
import { isAIPlatformError, AIPlatformError } from "./ai-errors";
import type { AIAgent } from "./ai-agent";
import type { AILogger } from "./ai-logger";
import { createExecutionLogEntry } from "./ai-logger";
import { buildUserPromptPayload } from "./ai-context";
import { createAgentRunResult } from "./ai-output";
import type { AIProvider } from "./ai-provider";
import type { AgentRunResult } from "./ai-types";
import type { LoadedPrompt } from "../prompts/prompt-loader";

export type AIRunnerDependencies = {
  provider: AIProvider;
  config: AIConfig;
  logger: AILogger;
  loadPrompt: (promptId: string) => Promise<LoadedPrompt>;
};

export class AIRunner {
  constructor(private readonly dependencies: AIRunnerDependencies) {}

  async runAgent<TInput, TSchema extends z.ZodTypeAny>(
    agent: AIAgent<TInput, TSchema>,
    input: {
      storeId: string;
      input: TInput;
      metadata?: Record<string, string>;
    },
  ): Promise<AgentRunResult<z.infer<TSchema>>> {
    const startedAt = Date.now();

    try {
      const facts = await agent.collectFacts(input.input);
      const prompt = await this.dependencies.loadPrompt(agent.promptId);

      const messages = [
        { role: "system" as const, content: prompt.body },
        {
          role: "user" as const,
          content: buildUserPromptPayload({
            storeId: input.storeId,
            ...facts,
          }),
        },
      ];

      const requestConfig = toRequestConfig(this.dependencies.config);
      const structured = await this.dependencies.provider.generateStructured({
        messages,
        config: requestConfig,
        schema: agent.outputSchema,
        schemaName: prompt.metadata.expectedSchema,
        metadata: input.metadata,
      });

      await agent.validateBusinessRules(facts, structured.data);

      const estimatedCost = await this.dependencies.provider.estimateCost({
        config: requestConfig,
        promptTokens: structured.usage.promptTokens,
        completionTokens: structured.usage.completionTokens,
      });

      this.dependencies.logger.logExecution(
        createExecutionLogEntry({
          agentId: agent.id,
          provider: structured.provider,
          model: structured.model,
          promptId: prompt.metadata.id,
          promptVersion: prompt.metadata.version,
          latencyMs: structured.latencyMs,
          estimatedCostUsd: estimatedCost.estimatedCostUsd,
          tokens: structured.usage,
          status: "success",
          validationStatus: structured.validationStatus,
          operation: "agent_run_success",
        }),
      );

      return createAgentRunResult({
        agentId: agent.id,
        output: structured.data,
        provider: structured.provider,
        model: structured.model,
        promptId: prompt.metadata.id,
        promptVersion: prompt.metadata.version,
        latencyMs: Date.now() - startedAt,
        estimatedCostUsd: estimatedCost.estimatedCostUsd,
        tokens: structured.usage,
        validationStatus: "valid",
      });
    } catch (error) {
      const platformError = isAIPlatformError(error)
        ? error
        : AIPlatformError.agentExecution(
            agent.id,
            error instanceof Error ? error.message : "Unknown agent execution error",
            error,
          );

      this.dependencies.logger.logExecution(
        createExecutionLogEntry({
          agentId: agent.id,
          provider: this.dependencies.config.provider,
          model: this.dependencies.config.model,
          promptId: agent.promptId,
          latencyMs: Date.now() - startedAt,
          estimatedCostUsd: null,
          tokens: {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
          },
          status: "failure",
          validationStatus: "invalid",
          errorCode: platformError.code,
          operation: "agent_run_failure",
        }),
      );

      throw platformError;
    }
  }
}
