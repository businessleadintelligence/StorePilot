import { describe, expect, it } from "vitest";

import { AIPlatformError, isAIPlatformError } from "../core/ai-errors";
import { mapOpenAIError } from "../providers/openai/openai-mapper";

describe("AI error normalization", () => {
  it("creates typed platform errors", () => {
    const error = AIPlatformError.schemaValidation("invalid schema");
    expect(error.code).toBe("schema_validation_failed");
    expect(error.retryable).toBe(false);
    expect(isAIPlatformError(error)).toBe(true);
  });

  it("maps OpenAI rate limit errors without exposing SDK details", () => {
    const mapped = mapOpenAIError({ status: 429, message: "Rate limit reached" });
    expect(mapped).toBeInstanceOf(AIPlatformError);
    expect(mapped.code).toBe("rate_limited");
    expect(mapped.message).not.toContain("OpenAI");
  });

  it("maps unknown provider failures to platform errors", () => {
    const mapped = mapOpenAIError(new Error("network down"));
    expect(mapped.code).toBe("unknown");
  });
});
