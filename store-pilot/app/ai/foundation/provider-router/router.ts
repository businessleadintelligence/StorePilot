import type { z } from "zod";

import { AIPlatformError } from "../../core/ai-errors";
import type { FoundationProviderId } from "../types/foundation-types";
import type {
  ProviderCapability,
  ProviderCostRates,
  ProviderGenerateInput,
  ProviderGenerateResult,
  ProviderHealthStatus,
  ProviderStructuredInput,
  ProviderStructuredResult,
} from "../types/provider-types";
import { AnthropicFoundationProvider } from "./providers/anthropic-provider";
import { GeminiFoundationProviderStub, GrokFoundationProviderStub, LocalFoundationProviderStub } from "./providers/future-provider.stubs";
import { OpenAIFoundationProvider } from "./providers/openai-provider";

export interface FoundationProviderAdapter {
  readonly id: FoundationProviderId;
  generateStructured<TSchema extends z.ZodTypeAny>(
    input: ProviderStructuredInput<TSchema>,
  ): Promise<ProviderStructuredResult<z.infer<TSchema>>>;
  generate(input: ProviderGenerateInput): Promise<ProviderGenerateResult>;
  healthCheck(): Promise<ProviderHealthStatus>;
  capability(modelId: string): ProviderCapability;
  costRates(modelId: string): ProviderCostRates;
}

export type ProviderRouterOptions = {
  env?: NodeJS.ProcessEnv;
  providers?: Partial<Record<FoundationProviderId, FoundationProviderAdapter>>;
  replaceDefaults?: boolean;
};

export class ProviderRouter {
  private readonly providers = new Map<
    FoundationProviderId,
    FoundationProviderAdapter
  >();

  constructor(options: ProviderRouterOptions = {}) {
    const env = options.env ?? process.env;
    if (!options.replaceDefaults) {
      const defaults: FoundationProviderAdapter[] = [
        new OpenAIFoundationProvider(env),
        new AnthropicFoundationProvider(env),
        new GeminiFoundationProviderStub(),
        new GrokFoundationProviderStub(),
        new LocalFoundationProviderStub(),
      ];

      for (const provider of defaults) {
        this.providers.set(provider.id, provider);
      }
    }

    if (options.providers) {
      for (const [id, provider] of Object.entries(options.providers)) {
        if (provider) {
          this.providers.set(id as FoundationProviderId, provider);
        }
      }
    }
  }

  resolve(providerId: FoundationProviderId): FoundationProviderAdapter {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw AIPlatformError.configuration(`Unsupported provider: ${providerId}`);
    }
    return provider;
  }

  listProviderIds(): FoundationProviderId[] {
    return [...this.providers.keys()];
  }

  async healthCheckAll(): Promise<ProviderHealthStatus[]> {
    const checks = await Promise.all(
      [...this.providers.values()].map((provider) => provider.healthCheck()),
    );
    return checks;
  }
}

export function createProviderRouter(
  options?: ProviderRouterOptions,
): ProviderRouter {
  return new ProviderRouter(options);
}
