import type { MerchantContext } from "../facts/types";
import { buildPromptChecksum } from "../cache/fingerprint";
import type { LoadedPrompt } from "../prompts/prompt-loader";

export type BuiltPrompt = {
  systemMessage: string;
  userMessage: string;
  promptId: string;
  promptVersion: string;
  promptChecksum: string;
  expectedSchema: string;
};

export type PromptBuildInput<TFacts> = {
  prompt: LoadedPrompt;
  facts: TFacts;
  merchantContext?: MerchantContext;
  memoryContext?: Record<string, unknown>;
};

export interface PromptBuilder<TFacts> {
  build(input: PromptBuildInput<TFacts>): Promise<BuiltPrompt>;
}

export class GenericPromptBuilder<TFacts> implements PromptBuilder<TFacts> {
  async build(input: PromptBuildInput<TFacts>): Promise<BuiltPrompt> {
    return {
      systemMessage: input.prompt.body,
      userMessage: JSON.stringify(
        {
          facts: input.facts,
          merchantContext: input.merchantContext ?? null,
          memoryContext: input.memoryContext ?? null,
          outputSchema: input.prompt.metadata.expectedSchema,
        },
        null,
        2,
      ),
      promptId: input.prompt.metadata.id,
      promptVersion: input.prompt.metadata.version,
      promptChecksum: buildPromptChecksum(input.prompt.body),
      expectedSchema: input.prompt.metadata.expectedSchema,
    };
  }
}

export const genericPromptBuilder = new GenericPromptBuilder<Record<string, unknown>>();
