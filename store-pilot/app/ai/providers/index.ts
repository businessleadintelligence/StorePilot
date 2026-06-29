import { loadAIConfig } from "../core/ai-config";
import { AIPlatformError } from "../core/ai-errors";
import type { AIProvider } from "../core/ai-provider";
import { OpenAIProvider, createOpenAIProvider } from "./openai/openai-provider";

export type ProviderRegistry = {
  getProvider(providerId: string): AIProvider;
  register(provider: AIProvider): void;
};

export class DefaultProviderRegistry implements ProviderRegistry {
  private readonly providers = new Map<string, AIProvider>();

  register(provider: AIProvider): void {
    this.providers.set(provider.id, provider);
  }

  getProvider(providerId: string): AIProvider {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw AIPlatformError.configuration(`AI provider not registered: ${providerId}`);
    }

    return provider;
  }
}

export type CreateDefaultAIPlatformOptions = {
  env?: NodeJS.ProcessEnv;
  registry?: ProviderRegistry;
};

export function createDefaultAIPlatform(options: CreateDefaultAIPlatformOptions = {}) {
  const env = options.env ?? process.env;
  const config = loadAIConfig({
    provider: env.AI_PROVIDER,
    model: env.AI_MODEL,
    temperature: env.AI_TEMPERATURE,
    maxTokens: env.AI_MAX_TOKENS,
    structuredOutputEnabled: env.AI_STRUCTURED_OUTPUT_ENABLED,
    timeoutMs: env.AI_TIMEOUT_MS,
  });

  const registry = options.registry ?? new DefaultProviderRegistry();

  if (config.provider === "openai") {
    registry.register(
      createOpenAIProvider({
        apiKey: env.OPENAI_API_KEY ?? "",
        aiConfig: config,
      }),
    );
  }

  return {
    config,
    registry,
    provider: registry.getProvider(config.provider),
  };
}
