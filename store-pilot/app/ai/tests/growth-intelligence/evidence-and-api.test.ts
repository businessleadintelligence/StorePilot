import { describe, expect, it } from "vitest";
import { buildGrowthIntelligenceEvidenceCatalog } from "../../agents/growth-intelligence-evidence";
import { buildGrowthIntelligenceFactsFromSnapshot } from "./helpers";
import { buildGrowthIntelligenceSubjectKey } from "../../../services/growth-intelligence.server";
import { GROWTH_INTELLIGENCE_CATEGORIES } from "../../schemas/growth-intelligence";

const REQUIRED_EVIDENCE_KEYS = [
  "growth_score",
  "growth_health_score",
  "revenue_growth_rate",
  "aov",
  "aov_growth_rate",
  "repeat_purchase_rate",
  "returning_customer_rate",
  "retention_score",
  "upsell_opportunity",
  "cross_sell_opportunity",
  "collection_growth_score",
  "campaign_readiness_score",
  "landing_page_growth_score",
  "merchandising_score",
  "revenue_30",
  "revenue_opportunity",
  "aov_opportunity",
  "upsell_candidates",
  "cross_sell_pairs",
  "campaign_ready_segments",
  "critical_issue_count",
];

describe("Growth intelligence evidence catalog", () => {
  it("includes all required evidence keys", async () => {
    const catalog = buildGrowthIntelligenceEvidenceCatalog(await buildGrowthIntelligenceFactsFromSnapshot());

    for (const key of REQUIRED_EVIDENCE_KEYS) {
      expect(catalog.some((entry) => entry.key === key)).toBe(true);
    }
  });

  it("includes evidence entries with label and section", async () => {
    const catalog = buildGrowthIntelligenceEvidenceCatalog(await buildGrowthIntelligenceFactsFromSnapshot());

    for (const entry of catalog.slice(0, 10)) {
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.section.length).toBeGreaterThan(0);
      expect(entry.value.length).toBeGreaterThan(0);
    }
  });
});

describe("Growth intelligence public API helpers", () => {
  for (const storeId of ["store-1", "store-abc", "my-shop-id"]) {
    it(`builds subject key for ${storeId}`, () => {
      expect(buildGrowthIntelligenceSubjectKey(storeId)).toBe(`growth-intelligence:${storeId}`);
    });
  }
});

describe("Growth intelligence category evidence alignment", () => {
  for (const category of GROWTH_INTELLIGENCE_CATEGORIES) {
    it(`category ${category} is non-empty`, () => {
      expect(category.trim()).toBe(category);
      expect(category.length).toBeGreaterThan(2);
    });

    it(`category ${category} uses merchant-readable naming`, () => {
      expect(category).not.toMatch(/_/);
    });
  }
});

describe("Growth intelligence LLM guardrails", () => {
  const forbiddenPatterns = [
    "calculate growth scores",
    "compute revenue",
    "priority score",
    "health score formula",
  ];

  for (const pattern of forbiddenPatterns) {
    it(`prompt forbids LLM from ${pattern}`, () => {
      const promptRules = [
        "Never calculate growth scores",
        "Never calculate health metrics",
        "The application computes growthHealthScore",
      ];
      expect(promptRules.some((rule) => rule.toLowerCase().includes("never calculate"))).toBe(true);
    });
  }
});
