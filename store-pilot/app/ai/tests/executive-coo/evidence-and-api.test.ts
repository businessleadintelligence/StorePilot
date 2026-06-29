import { describe, expect, it } from "vitest";

import {
  buildExecutiveCooEvidenceCatalog,
  resolveExecutiveCooEvidenceFromKeys,
  sectionScoreForFocusArea,
} from "../../agents/executive-coo-evidence";
import { EXECUTIVE_COO_FOCUS_AREAS } from "../../schemas/executive-coo";
import { buildExecutiveCooFactsFromSnapshot, buildValidExecutiveCooDraft } from "./helpers";

describe("Executive COO evidence catalog", () => {
  it("includes all required evidence keys", async () => {
    const facts = await buildExecutiveCooFactsFromSnapshot();
    const catalog = buildExecutiveCooEvidenceCatalog(facts);
    const keys = new Set(catalog.map((entry) => entry.key));

    expect(keys.has("operations_health_score")).toBe(true);
    expect(keys.has("inventory_risk")).toBe(true);
    expect(keys.has("revenue_opportunity")).toBe(true);
    expect(keys.has("open_specialist_recommendations")).toBe(true);
  });

  it("resolves evidence keys to merchant-readable strings", async () => {
    const facts = await buildExecutiveCooFactsFromSnapshot();
    const catalog = buildExecutiveCooEvidenceCatalog(facts);
    const resolved = resolveExecutiveCooEvidenceFromKeys(
      ["operations_health_score", "inventory_risk"],
      catalog,
    );

    expect(resolved.length).toBe(2);
    expect(resolved[0]).toContain("Operations health score");
  });

  it("scores focus areas from persisted facts", async () => {
    const facts = await buildExecutiveCooFactsFromSnapshot();
    expect(sectionScoreForFocusArea(facts, "Operations")).toBe(facts.operationsHealthScore);
    expect(sectionScoreForFocusArea(facts, "Inventory")).toBeGreaterThanOrEqual(0);
  });

  it("uses draft evidence keys from valid output", async () => {
    const facts = await buildExecutiveCooFactsFromSnapshot();
    const draft = buildValidExecutiveCooDraft(facts);
    const catalog = buildExecutiveCooEvidenceCatalog(facts);

    for (const priority of draft.topPriorities) {
      for (const key of priority.evidenceKeys) {
        expect(catalog.some((entry) => entry.key === key)).toBe(true);
      }
    }
  });
});

describe("Executive COO focus area section scores", () => {
  for (const focusArea of EXECUTIVE_COO_FOCUS_AREAS) {
    it(`returns bounded section score for ${focusArea}`, async () => {
      const facts = await buildExecutiveCooFactsFromSnapshot();
      const score = sectionScoreForFocusArea(facts, focusArea);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  }
});

describe("Executive COO focus area section scores", () => {
  for (const focusArea of EXECUTIVE_COO_FOCUS_AREAS) {
    it(`returns bounded section score for ${focusArea}`, async () => {
      const facts = await buildExecutiveCooFactsFromSnapshot();
      const score = sectionScoreForFocusArea(facts, focusArea);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  }
});

describe("Executive COO focus area section scores", () => {
  for (const focusArea of EXECUTIVE_COO_FOCUS_AREAS) {
    it(`returns bounded section score for ${focusArea}`, async () => {
      const facts = await buildExecutiveCooFactsFromSnapshot();
      const score = sectionScoreForFocusArea(facts, focusArea);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  }
});

describe("Executive COO focus area section scores", () => {
  for (const focusArea of EXECUTIVE_COO_FOCUS_AREAS) {
    it(`returns bounded section score for ${focusArea}`, async () => {
      const facts = await buildExecutiveCooFactsFromSnapshot();
      const score = sectionScoreForFocusArea(facts, focusArea);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  }
});

describe("Executive COO focus area section scores", () => {
  for (const focusArea of EXECUTIVE_COO_FOCUS_AREAS) {
    it(`returns bounded section score for ${focusArea}`, async () => {
      const facts = await buildExecutiveCooFactsFromSnapshot();
      const score = sectionScoreForFocusArea(facts, focusArea);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  }
});

describe("Executive COO focus area section scores", () => {
  for (const focusArea of EXECUTIVE_COO_FOCUS_AREAS) {
    it(`returns bounded section score for ${focusArea}`, async () => {
      const facts = await buildExecutiveCooFactsFromSnapshot();
      const score = sectionScoreForFocusArea(facts, focusArea);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  }
});
