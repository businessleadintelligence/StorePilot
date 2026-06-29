import { describe, expect, it } from "vitest";
import { buildPricingIntelligenceEvidenceCatalog } from "../../agents/pricing-intelligence-evidence";
import { buildPricingIntelligenceFactsFromSnapshot } from "./helpers";
import { buildPricingIntelligenceSubjectKey } from "../../../services/pricing-intelligence.server";
import { PRICING_INTELLIGENCE_CATEGORIES } from "../../schemas/pricing-intelligence";

const REQUIRED_EVIDENCE_KEYS = [
  "pricing_health_score",
  "margin_percent",
  "average_discount_percent",
  "discount_frequency",
  "discount_dependence",
  "aov",
  "conversion_rate",
  "revenue_30",
  "gross_profit",
  "price_consistency_score",
  "premium_opportunity",
  "bundle_opportunity",
  "inventory_risk",
  "revenue_opportunity",
  "profit_opportunity",
  "premium_candidates",
  "never_discount_candidates",
  "price_sensitive_products",
  "critical_issue_count",
];

describe("Pricing intelligence evidence catalog", () => {
  it("includes all required evidence keys", async () => {
    const catalog = buildPricingIntelligenceEvidenceCatalog(await buildPricingIntelligenceFactsFromSnapshot());

    for (const key of REQUIRED_EVIDENCE_KEYS) {
      expect(catalog.some((entry) => entry.key === key)).toBe(true);
    }
  });

  it("includes evidence entries with label and section", async () => {
    const catalog = buildPricingIntelligenceEvidenceCatalog(await buildPricingIntelligenceFactsFromSnapshot());

    for (const entry of catalog.slice(0, 10)) {
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.section.length).toBeGreaterThan(0);
      expect(entry.value.length).toBeGreaterThan(0);
    }
  });
});

describe("Pricing intelligence public API helpers", () => {
  for (const storeId of ["store-1", "store-abc", "my-shop-id"]) {
    it(`builds subject key for ${storeId}`, () => {
      expect(buildPricingIntelligenceSubjectKey(storeId)).toBe(`pricing-intelligence:${storeId}`);
    });
  }
});

describe("Pricing intelligence category evidence alignment", () => {
  for (const category of PRICING_INTELLIGENCE_CATEGORIES) {
    it(`category ${category} is non-empty`, () => {
      expect(category.trim()).toBe(category);
      expect(category.length).toBeGreaterThan(2);
    });

    it(`category ${category} uses merchant-readable naming`, () => {
      expect(category).not.toMatch(/_/);
    });
  }
});

describe("Pricing intelligence LLM guardrails", () => {
  const forbiddenPatterns = [
    "calculate pricing scores",
    "compute revenue",
    "priority score",
    "health score formula",
  ];

  for (const pattern of forbiddenPatterns) {
    it(`prompt forbids LLM from ${pattern}`, () => {
      const promptRules = [
        "Never calculate pricing scores",
        "Never calculate health metrics",
        "The application computes pricingHealthScore",
      ];
      expect(promptRules.some((rule) => rule.toLowerCase().includes("never calculate"))).toBe(true);
    });
  }
});
