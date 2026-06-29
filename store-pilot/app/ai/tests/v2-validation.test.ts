import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  decideMalformedJsonRetry,
  runValidationPipeline,
  shouldRetryMalformedJson,
} from "../validation/validation-pipeline";

const schema = z.object({
  summary: z.string().min(1),
  confidence: z.number().min(0).max(1),
});

describe("AI validation pipeline", () => {
  it("accepts valid structured payloads", async () => {
    const result = await runValidationPipeline({
      schema,
      payload: { summary: "Healthy inventory", confidence: 0.8 },
      facts: {},
      retryCount: 0,
    });

    expect(result.ok).toBe(true);
  });

  it("decides a single retry for malformed JSON", () => {
    expect(decideMalformedJsonRetry(0).shouldRetry).toBe(true);
    expect(decideMalformedJsonRetry(1).shouldRetry).toBe(false);
  });

  it("signals retry on first schema failure", async () => {
    const result = await runValidationPipeline({
      schema,
      payload: { summary: "", confidence: 2 },
      facts: {},
      retryCount: 0,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(shouldRetryMalformedJson(result)).toBe(true);
    }
  });
});
