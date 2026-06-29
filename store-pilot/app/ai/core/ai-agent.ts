import type { z } from "zod";

import type { AIProvider } from "./ai-provider";
import type { AgentRunInput, AgentRunResult } from "./ai-types";

export type AIAgentContext = {
  storeId: string;
  facts: Record<string, unknown>;
  metadata?: Record<string, string>;
};

export interface AIAgent<TInput, TSchema extends z.ZodTypeAny = z.ZodTypeAny> {
  readonly id: string;
  readonly promptId: string;
  readonly outputSchema: TSchema;

  collectFacts(input: TInput): Promise<Record<string, unknown>>;

  validateBusinessRules(
    facts: Record<string, unknown>,
    output: z.infer<TSchema>,
  ): Promise<void> | void;
}

export type AIAgentDependencies = {
  provider: AIProvider;
};

export abstract class BaseAIAgent<TInput, TSchema extends z.ZodTypeAny>
  implements AIAgent<TInput, TSchema>
{
  abstract readonly id: string;
  abstract readonly promptId: string;
  abstract readonly outputSchema: TSchema;

  protected constructor(protected readonly dependencies: AIAgentDependencies) {}

  abstract collectFacts(input: TInput): Promise<Record<string, unknown>>;

  validateBusinessRules(
    _facts: Record<string, unknown>,
    _output: z.infer<TSchema>,
  ): Promise<void> | void {
    return;
  }

  protected get provider(): AIProvider {
    return this.dependencies.provider;
  }
}

export type RunAgentInput<TInput> = AgentRunInput<TInput>;

export type RunAgentResult<TOutput> = AgentRunResult<TOutput>;
