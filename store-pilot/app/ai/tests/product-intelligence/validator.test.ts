import { describe, expect, it } from "vitest";

import { productIntelligenceSchema } from "../../schemas/product-intelligence";
import {
  extractProductIntelligenceRecommendations,
  isVagueRecommendationText,
  validateProductIntelligenceBusinessRules,
} from "../../agents/product-intelligence.validator";
import {
  buildRecommendationMemoryFromRecords,
  runWithProductIntelligenceContext,
} from "../../agents/agent-execution-context";
import { buildEvidenceCatalog, validateEvidenceKeys } from "../../agents/product-intelligence-evidence";
import { buildFactsWithHealthScore, buildValidProductIntelligenceDraft } from "./helpers";

describe("Product Intelligence schema", () => {
  it("accepts valid v2 draft output", () => {
    const facts = buildFactsWithHealthScore();
    const parsed = productIntelligenceSchema.safeParse(buildValidProductIntelligenceDraft(facts));

    expect(parsed.success).toBe(true);
  });

  it("rejects empty recommendations", () => {
    const facts = buildFactsWithHealthScore();
    const output = buildValidProductIntelligenceDraft(facts);
    output.recommendations = [];

    const parsed = productIntelligenceSchema.safeParse(output);
    expect(parsed.success).toBe(false);
  });
});

describe("Product Intelligence business validation", () => {
  it("rejects health score mismatches", () => {
    const facts = buildFactsWithHealthScore();
    const output = buildValidProductIntelligenceDraft(facts);
    output.healthScore = facts.healthScore + 1;

    expect(() => validateProductIntelligenceBusinessRules(facts, output)).toThrow(
      "health_score_mismatch",
    );
  });

  it("rejects duplicate recommendation ids", () => {
    const facts = buildFactsWithHealthScore();
    const output = buildValidProductIntelligenceDraft(facts);
    output.recommendations[1] = {
      ...output.recommendations[0],
      title: "Duplicate title for test",
    };

    expect(() => validateProductIntelligenceBusinessRules(facts, output)).toThrow(
      "duplicate_recommendation_id",
    );
  });

  it("rejects vague recommendations", () => {
    const facts = buildFactsWithHealthScore();
    const output = buildValidProductIntelligenceDraft(facts);
    output.recommendations[0].title = "Increase sales";

    expect(isVagueRecommendationText("Increase sales")).toBe(true);
    expect(() => validateProductIntelligenceBusinessRules(facts, output)).toThrow(
      "vague_recommendation",
    );
  });

  it("rejects invalid evidence keys", () => {
    const facts = buildFactsWithHealthScore();
    const output = buildValidProductIntelligenceDraft(facts);
    output.recommendations[0].evidenceKeys = ["made_up_metric"];

    expect(() => validateProductIntelligenceBusinessRules(facts, output)).toThrow(
      "enrichment_validation_failed",
    );
  });

  it("enriches output with health explanation and groups", () => {
    const facts = buildFactsWithHealthScore();
    const output = buildValidProductIntelligenceDraft(facts);

    validateProductIntelligenceBusinessRules(facts, output);

    expect(output.healthExplanation).toMatchObject({
      score: facts.healthScore,
      drivers: expect.any(Array),
    });
    expect(output.recommendationGroups).toBeDefined();
    expect(output.recommendations[0]).toMatchObject({
      evidence: expect.any(Array),
      priorityScore: expect.any(Number),
      group: expect.any(String),
      tasks: expect.any(Array),
    });
  });

  it("rejects regenerated implemented recommendations", () => {
    const facts = buildFactsWithHealthScore();
    const output = buildValidProductIntelligenceDraft(facts);

    runWithProductIntelligenceContext(
      {
        storeId: "store-1",
        subjectKey: "product:product-1",
        recommendationMemory: buildRecommendationMemoryFromRecords([
          {
            stableId: "stable-1",
            status: "implemented",
            payloadJson: { id: "inventory-replenishment-plan" },
          },
        ]),
      },
      () => {
        expect(() => validateProductIntelligenceBusinessRules(facts, output)).toThrow(
          "implemented_recommendation_regenerated",
        );
      },
    );
  });
});

describe("Product Intelligence recommendation extraction", () => {
  it("suppresses implemented and open recommendations", () => {
    const facts = buildFactsWithHealthScore();
    const output = buildValidProductIntelligenceDraft(facts);
    validateProductIntelligenceBusinessRules(facts, output);

    const extracted = runWithProductIntelligenceContext(
      {
        storeId: "store-1",
        subjectKey: "product:product-1",
        recommendationMemory: buildRecommendationMemoryFromRecords([
          {
            stableId: "stable-1",
            status: "implemented",
            payloadJson: { id: "inventory-replenishment-plan" },
          },
          {
            stableId: "stable-2",
            status: "open",
            payloadJson: { id: "bundle-best-seller" },
          },
        ]),
      },
      () => extractProductIntelligenceRecommendations(output),
    ) as ReturnType<typeof extractProductIntelligenceRecommendations>;

    expect(extracted).toHaveLength(0);
  });

  it("reduces priority for dismissed recommendations", () => {
    const facts = buildFactsWithHealthScore();
    const output = buildValidProductIntelligenceDraft(facts);
    validateProductIntelligenceBusinessRules(facts, output);

    const extracted = runWithProductIntelligenceContext(
      {
        storeId: "store-1",
        subjectKey: "product:product-1",
        recommendationMemory: buildRecommendationMemoryFromRecords([
          {
            stableId: "stable-1",
            status: "dismissed",
            payloadJson: { id: "inventory-replenishment-plan" },
          },
        ]),
      },
      () => extractProductIntelligenceRecommendations(output),
    ) as ReturnType<typeof extractProductIntelligenceRecommendations>;

    const dismissedRecommendation = output.recommendations.find(
      (recommendation) => recommendation.id === "inventory-replenishment-plan",
    );

    expect(
      extracted.find(
        (entry) => (entry.payload as { id?: string }).id === "inventory-replenishment-plan",
      )?.priority,
    ).toBe(Math.min(5, ((dismissedRecommendation as { priority?: number } | undefined)?.priority ?? 3) + 1));
  });
});

describe("Evidence catalog", () => {
  it("only allows fact-backed evidence keys", () => {
    const facts = buildFactsWithHealthScore();
    const catalog = buildEvidenceCatalog(facts);

    expect(() => validateEvidenceKeys(["sales_30d", "health_score"], catalog)).not.toThrow();
    expect(() => validateEvidenceKeys(["fake_metric"], catalog)).toThrow("invalid_evidence_key");
  });
});
