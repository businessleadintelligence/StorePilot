import type { z } from "zod";

import { createDefaultPromptRegistry } from "./prompt-registry";
import { createFoundationPipeline, type FoundationPipelineDependencies } from "./pipeline";
import type { FoundationRequest, FoundationResponse } from "./types/foundation-types";

export type AIFoundationClientOptions = Partial<FoundationPipelineDependencies>;

export class AIFoundationClient {
  private readonly pipeline;

  constructor(options: AIFoundationClientOptions = {}) {
    this.pipeline = createFoundationPipeline({
      promptRegistry: options.promptRegistry ?? createDefaultPromptRegistry(),
      ...options,
    });
  }

  execute<TSchema extends z.ZodTypeAny>(
    request: FoundationRequest<TSchema>,
  ): Promise<FoundationResponse<z.infer<TSchema>>> {
    return this.pipeline.execute(request);
  }
}

export function createAIFoundationClient(
  options?: AIFoundationClientOptions,
): AIFoundationClient {
  return new AIFoundationClient(options);
}
