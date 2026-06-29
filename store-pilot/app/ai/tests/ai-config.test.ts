import { describe, expect, it } from "vitest";

import { loadAIConfig, toRequestConfig } from "../core/ai-config";
import { AIPlatformError } from "../core/ai-errors";

describe("AI config loading", () => {
  it("loads config from environment source", () => {
    const config = loadAIConfig({
      provider: "openai",
      model: "configured-model",
      temperature: "0.3",
      maxTokens: "1500",
      structuredOutputEnabled: "true",
      timeoutMs: "45000",
    });

    expect(config).toEqual({
      provider: "openai",
      model: "configured-model",
      temperature: 0.3,
      maxTokens: 1500,
      structuredOutputEnabled: true,
      timeoutMs: 45000,
    });
  });

  it("throws when required fields are missing", () => {
    expect(() => loadAIConfig({ model: "x" })).toThrow(AIPlatformError);
    expect(() => loadAIConfig({ provider: "openai" })).toThrow(AIPlatformError);
  });

  it("maps config to request config", () => {
    const requestConfig = toRequestConfig(
      loadAIConfig({
        provider: "openai",
        model: "configured-model",
      }),
    );

    expect(requestConfig.provider).toBe("openai");
    expect(requestConfig.model).toBe("configured-model");
  });
});
