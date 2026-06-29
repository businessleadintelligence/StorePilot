import { describe, expect, it } from "vitest";

import { extractStoreAuditRecommendations } from "../../agents/store-audit.validator";
import { buildValidStoreAuditDraft, buildStoreAuditFactsFromSnapshot } from "./helpers";
import { runWithStoreAuditContext } from "../../agents/agent-execution-context";
import { storeAuditIntelligenceEnrichedSchema } from "../../schemas/store-audit-intelligence";
import { mutateAndEnrichStoreAuditOutput } from "../../agents/store-audit-enrichment";
import { getAgentDefinition } from "../../agents/agent-registry";

describe("Store Audit recommendation extraction", () => {
  it("filters implemented recommendations from extraction", () => {
    const facts = buildStoreAuditFactsFromSnapshot();
    const output = buildValidStoreAuditDraft(facts);

    runWithStoreAuditContext(
      {
        storeId: "store-1",
        subjectKey: "store-audit:store-1",
        recommendationMemory: {
          implementedIds: new Set(["audit:homepage-social-proof"]),
          dismissedIds: new Set(),
          openIds: new Set(),
          snoozedIds: new Set(),
          ignoredIds: new Set(),
        },
      },
      () => {
        const extracted = extractStoreAuditRecommendations(output);
        expect(extracted.some((item) => item.title.includes("social proof"))).toBe(false);
      },
    );
  });

  it("deprioritizes dismissed recommendations", () => {
    const facts = buildStoreAuditFactsFromSnapshot();
    const output = buildValidStoreAuditDraft(facts);

    runWithStoreAuditContext(
      {
        storeId: "store-1",
        subjectKey: "store-audit:store-1",
        recommendationMemory: {
          implementedIds: new Set(),
          dismissedIds: new Set(["audit:product-sku-cleanup"]),
          openIds: new Set(),
          snoozedIds: new Set(),
          ignoredIds: new Set(),
        },
      },
      () => {
        const extracted = extractStoreAuditRecommendations(output);
        const dismissed = extracted.find((item) => item.title.includes("SKU"));
        expect(dismissed?.priority).toBeGreaterThan(2);
      },
    );
  });

  it("enriched schema includes verification and tasks", () => {
    const facts = buildStoreAuditFactsFromSnapshot();
    const enriched = mutateAndEnrichStoreAuditOutput({
      facts,
      output: buildValidStoreAuditDraft(facts),
    });

    expect(storeAuditIntelligenceEnrichedSchema.safeParse(enriched).success).toBe(true);
    expect(enriched.recommendations[0]?.tasks.length).toBeGreaterThan(0);
    expect(enriched.recommendations[0]?.verification.expectedWindow).toBeTruthy();
  });

  it("registers store audit agent with extractRecommendations hook", () => {
    const definition = getAgentDefinition("store_audit");
    const facts = buildStoreAuditFactsFromSnapshot();
    const output = buildValidStoreAuditDraft(facts);
    const enriched = mutateAndEnrichStoreAuditOutput({ facts, output });

    expect(definition.extractRecommendations).toBeDefined();

    const extracted = definition.extractRecommendations!({
      agentId: "store_audit",
      subjectKey: "store-audit:store-1",
      output: enriched,
    });

    expect(extracted.length).toBeGreaterThan(0);
    expect(extracted[0]?.category).toBeTruthy();
  });
});

describe("Store Audit score invariants", () => {
  it("preserves all section scores through enrichment", () => {
    const facts = buildStoreAuditFactsFromSnapshot();
    const enriched = mutateAndEnrichStoreAuditOutput({
      facts,
      output: buildValidStoreAuditDraft(facts),
    });

    expect(enriched.homepageScore).toBe(facts.homepageScore);
    expect(enriched.seoScore).toBe(facts.seoScore);
    expect(enriched.accessibilityScore).toBe(facts.accessibilityScore);
    expect(enriched.performanceScore).toBe(facts.performanceScore);
    expect(enriched.conversionScore).toBe(facts.conversionScore);
    expect(enriched.mobileScore).toBe(facts.mobileScore);
    expect(enriched.themeScore).toBe(facts.themeScore);
  });
});
