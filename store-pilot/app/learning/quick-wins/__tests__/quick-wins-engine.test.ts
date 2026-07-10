import { describe, expect, it } from "vitest";

import { buildEvidenceFactGroups } from "../shared/evidence-loader";
import { buildQuickWinCandidates } from "../generator/candidate-builder";
import { detectSlowMovingProducts } from "../catalog/slow-moving";
import { scoreQuickWinCandidates } from "../scoring/quick-win-scoring";
import {
  buildTrialHighlights,
  prioritizeForTrial,
  rankQuickWins,
} from "../ranking/quick-win-ranking";
import {
  estimateAverageOrderValue,
  estimateRevenueOpportunity,
  sumRevenueOpportunity,
} from "../impact/impact-estimator";

const sampleRows = [
  { id: "e1", factType: "MissingSEO", entityId: "p1", confidence: 0.9 },
  { id: "e2", factType: "MissingSEO", entityId: "p2", confidence: 0.88 },
  { id: "e3", factType: "InventoryLow", entityId: "v1", confidence: 0.95 },
  { id: "e4", factType: "InventoryCritical", entityId: "v2", confidence: 0.92 },
  { id: "e5", factType: "OutOfStock", entityId: "v3", confidence: 0.98 },
  { id: "e6", factType: "PriceAboveCategoryAverage", entityId: "p3", confidence: 0.85 },
  { id: "e7", factType: "BundleCandidateSeed", entityId: "p4", confidence: 0.8 },
  { id: "e8", factType: "NeverSold", entityId: "p5", confidence: 0.75 },
  { id: "e9", factType: "HighInventory", entityId: "p5", confidence: 0.77 },
  { id: "e10", factType: "NeverSold", entityId: "p6", confidence: 0.7 },
];

describe("Quick Wins Engine", () => {
  describe("evidence grouping", () => {
    it("groups evidence rows by fact type deterministically", () => {
      const groups = buildEvidenceFactGroups(sampleRows);
      expect(groups.get("MissingSEO")?.count).toBe(2);
      expect(groups.get("InventoryLow")?.count).toBe(1);
    });
  });

  describe("candidate builder", () => {
    it("builds quick win candidates from evidence fact groups", () => {
      const groups = buildEvidenceFactGroups(sampleRows);
      const candidates = buildQuickWinCandidates({
        groups,
        evidenceRows: sampleRows,
      });

      expect(candidates.some((candidate) => candidate.winType === "missing_seo")).toBe(
        true,
      );
      expect(candidates.some((candidate) => candidate.winType === "inventory_risk")).toBe(
        true,
      );
      expect(
        candidates.some((candidate) => candidate.winType === "pricing_outlier"),
      ).toBe(true);
      expect(
        candidates.some((candidate) => candidate.winType === "bundle_candidate"),
      ).toBe(true);
    });
  });

  describe("slow moving detection", () => {
    it("detects entities with both never sold and high inventory signals", () => {
      const result = detectSlowMovingProducts(sampleRows);
      expect(result.affectedCount).toBe(1);
    });
  });

  describe("scoring and impact", () => {
    it("scores wins with business impact, confidence, and revenue opportunity", () => {
      const groups = buildEvidenceFactGroups(sampleRows);
      const candidates = buildQuickWinCandidates({
        groups,
        evidenceRows: sampleRows,
      });
      const scored = scoreQuickWinCandidates(candidates, 115);

      expect(scored.every((win) => win.businessImpact >= 10)).toBe(true);
      expect(scored.every((win) => win.confidence >= 0.35)).toBe(true);
      expect(scored.every((win) => win.revenueOpportunity >= 0)).toBe(true);
      expect(sumRevenueOpportunity(scored)).toBeGreaterThan(0);
    });

    it("uses merchant baseline AOV when available", () => {
      const aov = estimateAverageOrderValue({ averageOrderValue: 120 });
      expect(aov).toBe(120);
    });

    it("estimates revenue opportunity from affected count and category weight", () => {
      const opportunity = estimateRevenueOpportunity(
        {
          winType: "missing_seo",
          category: "seo",
          title: "2 products missing SEO",
          description: "test",
          affectedCount: 14,
          evidenceIds: [],
          sourceFactTypes: ["MissingSEO"],
          avgConfidence: 0.9,
          effort: 1,
          impactWeight: 0.75,
          urgencyBoost: 10,
        },
        100,
      );
      expect(opportunity).toBeGreaterThan(0);
    });
  });

  describe("ranking and trial prioritization", () => {
    it("ranks wins by composite score deterministically", () => {
      const groups = buildEvidenceFactGroups(sampleRows);
      const scored = scoreQuickWinCandidates(
        buildQuickWinCandidates({ groups, evidenceRows: sampleRows }),
        115,
      );
      const ranked = rankQuickWins(scored);

      for (let index = 1; index < ranked.length; index += 1) {
        expect(ranked[index - 1]!.rankScore).toBeGreaterThanOrEqual(
          ranked[index]!.rankScore,
        );
      }
    });

    it("builds trial highlights for dashboard headline", () => {
      const groups = buildEvidenceFactGroups(sampleRows);
      const scored = scoreQuickWinCandidates(
        buildQuickWinCandidates({ groups, evidenceRows: sampleRows }),
        115,
      );
      const prioritized = prioritizeForTrial(scored);
      const highlights = buildTrialHighlights(prioritized);

      expect(highlights.length).toBeGreaterThan(0);
      expect(highlights[0]?.count).toBeGreaterThan(0);
    });
  });
});
