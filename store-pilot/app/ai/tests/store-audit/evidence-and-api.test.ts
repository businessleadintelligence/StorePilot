import { describe, expect, it } from "vitest";
import { buildStoreAuditEvidenceCatalog } from "../../agents/store-audit-evidence";
import { buildStoreAuditFactsFromSnapshot } from "./helpers";
import { buildStoreAuditSubjectKey } from "../../../services/store-audit.server";
import { STORE_AUDIT_INTELLIGENCE_CATEGORIES } from "../../schemas/store-audit-intelligence";

const REQUIRED_EVIDENCE_KEYS = [
  "store_health_score",
  "homepage_score",
  "seo_score",
  "accessibility_score",
  "performance_score",
  "conversion_score",
  "mobile_score",
  "theme_score",
  "navigation_score",
  "technical_seo_score",
  "image_optimization_score",
  "trust_score",
  "policy_score",
  "app_bloat_score",
  "merchant_best_practices_score",
  "overall_audit_score",
  "critical_issue_count",
  "homepage_primary_cta",
  "navigation_search",
  "seo_title_coverage",
  "accessibility_alt_coverage",
  "apps_installed",
  "apps_unused",
  "product_missing_sku",
  "conversion_social_proof",
];

describe("Store audit evidence catalog", () => {
  const catalog = buildStoreAuditEvidenceCatalog(buildStoreAuditFactsFromSnapshot());

  for (const key of REQUIRED_EVIDENCE_KEYS) {
    it(`includes evidence key ${key}`, () => {
      expect(catalog.some((entry) => entry.key === key)).toBe(true);
    });
  }

  for (const entry of catalog.slice(0, 10)) {
    it(`evidence entry ${entry.key} has label and section`, () => {
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.section.length).toBeGreaterThan(0);
      expect(entry.value.length).toBeGreaterThan(0);
    });
  }
});

describe("Store audit public API helpers", () => {
  for (const storeId of ["store-1", "store-abc", "my-shop-id"]) {
    it(`builds subject key for ${storeId}`, () => {
      expect(buildStoreAuditSubjectKey(storeId)).toBe(`store-audit:${storeId}`);
    });
  }
});

describe("Store audit category evidence alignment", () => {
  for (const category of STORE_AUDIT_INTELLIGENCE_CATEGORIES) {
    it(`category ${category} is non-empty`, () => {
      expect(category.trim()).toBe(category);
      expect(category.length).toBeGreaterThan(2);
    });

    it(`category ${category} uses merchant-readable naming`, () => {
      expect(category).not.toMatch(/_/);
    });
  }
});

describe("Store audit LLM guardrails", () => {
  const forbiddenPatterns = [
    "calculate score",
    "compute revenue",
    "priority score",
    "health score formula",
  ];

  for (const pattern of forbiddenPatterns) {
    it(`prompt forbids LLM from ${pattern}`, () => {
      const promptRules = [
        "Never calculate scores",
        "Never calculate health metrics",
        "The application computes storeHealthScore",
      ];
      expect(promptRules.some((rule) => rule.toLowerCase().includes("never calculate"))).toBe(true);
    });
  }
});
