import { describe, expect, it } from "vitest";
import { createStoreAuditFactsBuilder } from "../../facts/store-audit-facts";
import { buildValidStoreAuditDraft, createMockStoreAuditSnapshot } from "./helpers";
import { validateStoreAuditBusinessRules } from "../../agents/store-audit.validator";
import { storeAuditIntelligenceSchema } from "../../schemas/store-audit-intelligence";

describe("debug", () => {
  it("validates builder facts", async () => {
    const snapshot = createMockStoreAuditSnapshot();
    const builder = createStoreAuditFactsBuilder({
      async getStoreAuditSnapshot() {
        return snapshot;
      },
    });
    const facts = await builder.build({ storeId: "store-1" });
    const output = buildValidStoreAuditDraft(facts);
    const parsed = storeAuditIntelligenceSchema.safeParse(output);
    expect(parsed.success).toBe(true);
    validateStoreAuditBusinessRules(facts, output);
  });
});
