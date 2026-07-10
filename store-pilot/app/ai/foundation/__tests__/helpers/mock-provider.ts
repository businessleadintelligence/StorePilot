import type { z } from "zod";

import type { FoundationProviderId } from "../../types/foundation-types";
import type {
  ProviderCapability,
  ProviderCostRates,
  ProviderGenerateInput,
  ProviderGenerateResult,
  ProviderHealthStatus,
  ProviderStructuredInput,
  ProviderStructuredResult,
} from "../../types/provider-types";
import type { FoundationProviderAdapter } from "../../provider-router/router";
import { ProviderRouter } from "../../provider-router/router";

export type MockProviderBehavior = {
  structuredResponses?: Array<string | Error>;
  healthHealthy?: boolean;
};

export class MockFoundationProvider implements FoundationProviderAdapter {
  readonly calls: ProviderStructuredInput<z.ZodTypeAny>[] = [];

  constructor(
    readonly id: FoundationProviderId,
    private readonly behavior: MockProviderBehavior = {},
  ) {}

  async generate(input: ProviderGenerateInput): Promise<ProviderGenerateResult> {
    const structured = await this.generateStructured({
      ...input,
      schema: { parse: (value: unknown) => value } as z.ZodTypeAny,
      schemaName: "mock",
    });
    return {
      content: structured.rawContent,
      model: structured.model,
      usage: structured.usage,
      finishReason: structured.finishReason,
      latencyMs: structured.latencyMs,
    };
  }

  async generateStructured<TSchema extends z.ZodTypeAny>(
    input: ProviderStructuredInput<TSchema>,
  ): Promise<ProviderStructuredResult<z.infer<TSchema>>> {
    this.calls.push(input);
    const queue = this.behavior.structuredResponses ?? [];
    const next = queue[this.calls.length - 1];

    if (next instanceof Error) {
      throw next;
    }

    const rawContent =
      next ??
      JSON.stringify({
        label: "ok",
        confidence: 0.9,
      });

    return {
      data: JSON.parse(rawContent) as z.infer<TSchema>,
      model: input.model,
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      finishReason: "stop",
      latencyMs: 12,
      rawContent,
    };
  }

  async healthCheck(): Promise<ProviderHealthStatus> {
    return {
      providerId: this.id,
      healthy: this.behavior.healthHealthy ?? true,
      latencyMs: 5,
      message: "mock",
    };
  }

  capability(): ProviderCapability {
    return {
      supportsStructuredOutput: true,
      supportsJsonSchema: true,
      contextWindowTokens: 128_000,
    };
  }

  costRates(): ProviderCostRates {
    return { promptUsdPer1k: 0.001, completionUsdPer1k: 0.002 };
  }
}

export function createMockProviderRouter(provider: MockFoundationProvider): ProviderRouter {
  return new ProviderRouter({
    replaceDefaults: true,
    providers: { [provider.id]: provider },
  });
}
