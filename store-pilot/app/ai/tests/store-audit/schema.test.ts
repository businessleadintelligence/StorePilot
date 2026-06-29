import { describe, expect, it } from "vitest";

import {
  STORE_AUDIT_INTELLIGENCE_CATEGORIES,
  storeAuditIntelligenceEnrichedSchema,
  storeAuditIntelligenceSchema,
} from "../../schemas/store-audit-intelligence";
import {
  buildStoreAuditFactsFromSnapshot,
  buildValidStoreAuditDraft,
} from "./helpers";
import { mutateAndEnrichStoreAuditOutput } from "../../agents/store-audit-enrichment";

describe("Store Audit Intelligence schema", () => {
  it("accepts a valid draft output", () => {
    const facts = buildStoreAuditFactsFromSnapshot();
    const draft = buildValidStoreAuditDraft(facts);

    expect(storeAuditIntelligenceSchema.safeParse(draft).success).toBe(true);
  });

  it("accepts enriched output after deterministic enrichment", () => {
    const facts = buildStoreAuditFactsFromSnapshot();
    const draft = buildValidStoreAuditDraft(facts);
    const enriched = mutateAndEnrichStoreAuditOutput({ facts, output: draft });

    expect(storeAuditIntelligenceEnrichedSchema.safeParse(enriched).success).toBe(true);
    expect(enriched.recommendations[0]?.evidence.length).toBeGreaterThan(0);
    expect(
      Object.values(enriched.recommendationGroups).some((group) => group.length > 0),
    ).toBe(true);
  });

  it("defines all required audit categories", () => {
    expect(STORE_AUDIT_INTELLIGENCE_CATEGORIES).toContain("Images");
    expect(STORE_AUDIT_INTELLIGENCE_CATEGORIES).toContain("Technical SEO");
    expect(STORE_AUDIT_INTELLIGENCE_CATEGORIES).toContain("Merchant Best Practices");
    expect(STORE_AUDIT_INTELLIGENCE_CATEGORIES.length).toBe(17);
  });
});
