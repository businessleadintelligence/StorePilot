import { describe, expect, it } from "vitest";

import {
  assertConfidenceRange,
  validateStructuredOutput,
} from "../core/ai-output";
import { AIPlatformError } from "../core/ai-errors";
import {
  executiveSummarySchema,
  productRecommendationSchema,
  storeAuditSchema,
} from "../schemas";

describe("Structured output validation", () => {
  it("accepts valid product recommendation payloads", () => {
    const result = validateStructuredOutput(productRecommendationSchema, {
      recommendation: "Refresh product images",
      confidence: 0.9,
      impact: "high",
      reasoning: "Images are outdated",
      priority: 2,
    });

    expect(result.validationStatus).toBe("valid");
  });

  it("rejects invalid store audit payloads", () => {
    expect(() =>
      validateStructuredOutput(storeAuditSchema, {
        issues: [],
        recommendations: [],
        score: 150,
        confidence: 0.5,
      }),
    ).toThrow(AIPlatformError);
  });

  it("validates executive summary schema", () => {
    const result = validateStructuredOutput(executiveSummarySchema, {
      priorities: ["Fix low stock alerts"],
      risks: ["Conversion drop on top SKU"],
      opportunities: ["Bundle slow movers"],
      executiveSummary: "Focus on inventory-led recovery this week.",
    });

    expect(result.data.priorities).toHaveLength(1);
  });

  it("enforces business-rule confidence ranges", () => {
    expect(() => assertConfidenceRange(1.5)).toThrow(AIPlatformError);
  });
});
