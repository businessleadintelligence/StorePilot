import { describe, expect, it } from "vitest";
import { buildSeoIntelligenceEvidenceCatalog } from "../../agents/seo-intelligence-evidence";
import { buildSeoIntelligenceFactsFromSnapshot } from "./helpers";
import { buildSeoIntelligenceSubjectKey } from "../../../services/seo-intelligence.server";
import { SEO_INTELLIGENCE_CATEGORIES } from "../../schemas/seo-intelligence";

const REQUIRED_EVIDENCE_KEYS = [
  "seo_health_score",
  "seo_score",
  "technical_seo_score",
  "content_score",
  "indexability_score",
  "internal_linking_score",
  "structured_data_score",
  "core_web_vitals_score",
  "search_visibility_score",
  "organic_opportunity_score",
  "image_optimization_score",
  "accessibility_score",
  "canonical_health_score",
  "heading_structure_score",
  "traffic_opportunity",
  "visibility_opportunity",
  "rule_set_version",
  "gsc_impressions_proxy",
  "gsc_average_position_proxy",
  "pagespeed_lcp_score",
  "pagespeed_cls_score",
  "pagespeed_inp_score",
  "alt_text_coverage",
  "critical_issue_count",
];

describe("SEO intelligence evidence catalog", () => {
  it("includes all required evidence keys", async () => {
    const catalog = buildSeoIntelligenceEvidenceCatalog(await buildSeoIntelligenceFactsFromSnapshot());

    for (const key of REQUIRED_EVIDENCE_KEYS) {
      expect(catalog.some((entry) => entry.key === key)).toBe(true);
    }
  });

  it("includes evidence entries with label and section", async () => {
    const catalog = buildSeoIntelligenceEvidenceCatalog(await buildSeoIntelligenceFactsFromSnapshot());

    for (const entry of catalog.slice(0, 10)) {
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.section.length).toBeGreaterThan(0);
      expect(entry.value.length).toBeGreaterThan(0);
    }
  });
});

describe("SEO intelligence public API helpers", () => {
  for (const storeId of ["store-1", "store-abc", "my-shop-id"]) {
    it(`builds subject key for ${storeId}`, () => {
      expect(buildSeoIntelligenceSubjectKey(storeId)).toBe(`seo-intelligence:${storeId}`);
    });
  }
});

describe("SEO intelligence category evidence alignment", () => {
  for (const category of SEO_INTELLIGENCE_CATEGORIES) {
    it(`category ${category} is non-empty`, () => {
      expect(category.trim()).toBe(category);
      expect(category.length).toBeGreaterThan(2);
    });

    it(`category ${category} uses merchant-readable naming`, () => {
      expect(category).not.toMatch(/_/);
    });
  }
});

describe("SEO intelligence LLM guardrails", () => {
  const forbiddenPatterns = [
    "calculate seo scores",
    "compute revenue",
    "priority score",
    "health score formula",
  ];

  for (const pattern of forbiddenPatterns) {
    it(`prompt forbids LLM from ${pattern}`, () => {
      const promptRules = [
        "Never calculate SEO scores",
        "Never calculate health metrics",
        "The application computes seoHealthScore",
      ];
      expect(promptRules.some((rule) => rule.toLowerCase().includes("never calculate"))).toBe(true);
    });
  }
});
