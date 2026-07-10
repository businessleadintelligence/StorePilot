import type { HistoricalAggregationSnapshot, PatternSeedRecord } from "../shared/types";

export function buildPatternSeeds(
  snapshot: HistoricalAggregationSnapshot,
): PatternSeedRecord[] {
  const patterns: PatternSeedRecord[] = [];

  const weekdayOrders = snapshot.ordersByDayOfWeek
    .filter((bucket) => bucket.dayOfWeek >= 1 && bucket.dayOfWeek <= 5)
    .reduce((sum, bucket) => sum + bucket.orderCount, 0);
  const weekendOrders =
    (snapshot.ordersByDayOfWeek[0]?.orderCount ?? 0) +
    (snapshot.ordersByDayOfWeek[6]?.orderCount ?? 0);
  const weekdayAvg = weekdayOrders / 5;
  if (weekdayAvg > 0 && weekendOrders / 2 > weekdayAvg * 1.15) {
    patterns.push({
      patternType: "weekend_sales_lift",
      semanticLabel: "weekend_order_lift",
      confidence: Math.min(0.95, 0.6 + (weekendOrders / (weekdayAvg * 2)) * 0.15),
      observationCount: weekendOrders,
      evidenceIds: [],
      patternJson: {
        weekendOrders,
        weekdayAverage: round(weekdayAvg),
        liftPercent: round(((weekendOrders / 2 - weekdayAvg) / weekdayAvg) * 100),
      },
    });
  }

  if (snapshot.refundRatio >= 0.03) {
    patterns.push({
      patternType: "high_refund_rate",
      semanticLabel: "refund_ratio_elevated",
      confidence: Math.min(0.98, 0.5 + snapshot.refundRatio * 5),
      observationCount: snapshot.orderCount,
      evidenceIds: [],
      patternJson: {
        refundRatio: snapshot.refundRatio,
        threshold: 0.03,
      },
    });
  }

  if (snapshot.lowStockEvidenceCount + snapshot.outOfStockEvidenceCount >= 3) {
    patterns.push({
      patternType: "inventory_pressure",
      semanticLabel: "inventory_stress_signals",
      confidence: Math.min(0.92, 0.55 + (snapshot.outOfStockEvidenceCount * 0.08)),
      observationCount:
        snapshot.lowStockEvidenceCount + snapshot.outOfStockEvidenceCount,
      evidenceIds: [],
      patternJson: {
        lowStockEvidenceCount: snapshot.lowStockEvidenceCount,
        outOfStockEvidenceCount: snapshot.outOfStockEvidenceCount,
      },
    });
  }

  const seasonalEvidence = snapshot.evidenceByFactType.SeasonalCandidate ?? 0;
  if (seasonalEvidence > 0) {
    patterns.push({
      patternType: "seasonal_candidate",
      semanticLabel: "seasonal_product_candidates",
      confidence: Math.min(0.9, 0.5 + seasonalEvidence * 0.05),
      observationCount: seasonalEvidence,
      evidenceIds: [],
      patternJson: { seasonalCandidateCount: seasonalEvidence },
    });
  }

  const priceChanges = snapshot.evidenceByFactType.PriceChanged ?? 0;
  if (priceChanges >= 2) {
    patterns.push({
      patternType: "pricing_volatility",
      semanticLabel: "price_change_activity",
      confidence: Math.min(0.88, 0.45 + priceChanges * 0.04),
      observationCount: priceChanges,
      evidenceIds: [],
      patternJson: { priceChangeEvidenceCount: priceChanges },
    });
  }

  if (snapshot.topProductTitles.length > 0 && snapshot.productCount > 0) {
    const topShare = snapshot.topProductTitles[0].count / snapshot.productCount;
    if (topShare >= 0.15) {
      patterns.push({
        patternType: "category_concentration",
        semanticLabel: "top_product_concentration",
        confidence: Math.min(0.85, 0.5 + topShare),
        observationCount: snapshot.topProductTitles[0].count,
        evidenceIds: [],
        patternJson: {
          topProduct: snapshot.topProductTitles[0],
          concentrationShare: round(topShare, 4),
        },
      });
    }
  }

  if (snapshot.prior30DayRevenue > 0) {
    const growthRate =
      (snapshot.recent30DayRevenue - snapshot.prior30DayRevenue) /
      snapshot.prior30DayRevenue;
    if (Math.abs(growthRate) >= 0.1) {
      patterns.push({
        patternType: "order_growth",
        semanticLabel: growthRate >= 0 ? "revenue_growth_30d" : "revenue_decline_30d",
        confidence: Math.min(0.94, 0.55 + Math.abs(growthRate) * 0.5),
        observationCount: snapshot.orderCount,
        evidenceIds: [],
        patternJson: {
          growthRate: round(growthRate, 4),
          recent30DayRevenue: snapshot.recent30DayRevenue,
          prior30DayRevenue: snapshot.prior30DayRevenue,
        },
      });
    }
  }

  return patterns;
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
