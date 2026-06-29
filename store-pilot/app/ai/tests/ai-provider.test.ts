import { describe, expect, it } from "vitest";

import {
  DefaultProviderRegistry,
  createDefaultAIPlatform,
} from "../providers";
import { createMockAIProvider } from "./helpers/mock-provider";
import { AIPlatformError } from "../core/ai-errors";
import { OpenAIProvider } from "../providers/openai/openai-provider";
import { loadAIConfig } from "../core/ai-config";

describe("Provider registry and dependency injection", () => {
  it("resolves registered providers by id", () => {
    const registry = new DefaultProviderRegistry();
    const provider = createMockAIProvider("mock-provider");
    registry.register(provider);

    expect(registry.getProvider("mock-provider")).toBe(provider);
  });

  it("throws when provider is not registered", () => {
    const registry = new DefaultProviderRegistry();
    expect(() => registry.getProvider("missing")).toThrow(AIPlatformError);
  });

  it("creates default platform with injected OpenAI provider from env", () => {
    const registry = new DefaultProviderRegistry();
    const platform = createDefaultAIPlatform({
      env: {
        AI_PROVIDER: "openai",
        AI_MODEL: "configured-model",
        OPENAI_API_KEY: "test-key",
      },
      registry,
    });

    expect(platform.provider.id).toBe("openai");
    expect(platform.config.model).toBe("configured-model");
  });

  it("does not expose OpenAI SDK outside provider package", () => {
    expect(OpenAIProvider.name).toBe("OpenAIProvider");
    expect(loadAIConfig({ provider: "openai", model: "configured-model" }).provider).toBe(
      "openai",
    );
  });
});
