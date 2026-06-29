import { describe, expect, it } from "vitest";

import { AIPlatformError } from "../../core/ai-errors";
import {
  buildStoreAuditFactsFromSnapshot,
  buildValidStoreAuditDraft,
  createMockStoreAuditSnapshot,
} from "./helpers";
import { createStoreAuditFactsBuilder } from "../../facts/store-audit-facts";
import {
  isVagueStoreAuditRecommendationText,
  validateStoreAuditBusinessRules,
} from "../../agents/store-audit.validator";
import { mutateAndEnrichStoreAuditOutput } from "../../agents/store-audit-enrichment";

describe("Store Audit validator", () => {
  it("rejects health score mismatch", () => {
    const facts = buildStoreAuditFactsFromSnapshot();
    const output = buildValidStoreAuditDraft(facts);
    output.storeHealthScore = facts.storeHealthScore + 5;

    expect(() => validateStoreAuditBusinessRules(facts, output)).toThrow(AIPlatformError);
  });

  it("rejects duplicate recommendation ids", () => {
    const facts = buildStoreAuditFactsFromSnapshot();
    const output = buildValidStoreAuditDraft(facts);
    output.recommendations[1] = { ...output.recommendations[0]! };

    expect(() => validateStoreAuditBusinessRules(facts, output)).toThrow(AIPlatformError);
  });

  it("rejects unknown evidence keys", () => {
    const facts = buildStoreAuditFactsFromSnapshot();
    const output = buildValidStoreAuditDraft(facts);
    output.recommendations[0]!.evidenceKeys = ["unknown_evidence_key"];

    expect(() => validateStoreAuditBusinessRules(facts, output)).toThrow(AIPlatformError);
  });

  it("rejects vague recommendations", () => {
    expect(isVagueStoreAuditRecommendationText("fix seo")).toBe(true);
  });

  it("enriches valid output in-place", () => {
    const facts = buildStoreAuditFactsFromSnapshot();
    const output = buildValidStoreAuditDraft(facts);

    validateStoreAuditBusinessRules(facts, output);

    const enrichedRecommendation = output.recommendations[0] as typeof output.recommendations[number] & {
      evidence?: string[];
    };
    expect(output.healthExplanation?.score).toBe(facts.storeHealthScore);
    expect(enrichedRecommendation.evidence?.length).toBeGreaterThan(0);
  });

  it("mutates enriched recommendations with groups and verification", () => {
    const facts = buildStoreAuditFactsFromSnapshot();
    const output = buildValidStoreAuditDraft(facts);
    const enriched = mutateAndEnrichStoreAuditOutput({ facts, output });

    expect(enriched.recommendations[0]?.group).toBeTruthy();
    expect(enriched.recommendations[0]?.verification.expectedMetric).toBeTruthy();
  });

  it("validates builder-backed draft output", async () => {
    const snapshot = createMockStoreAuditSnapshot();
    const builder = createStoreAuditFactsBuilder({
      async getStoreAuditSnapshot() {
        return snapshot;
      },
    });
    const facts = await builder.build({ storeId: "store-1", agentId: "store_audit" });
    const output = buildValidStoreAuditDraft(facts);

    validateStoreAuditBusinessRules(facts, output);
  });
});
