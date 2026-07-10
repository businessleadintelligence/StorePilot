import type { HistoricalAggregationSnapshot, MerchantBaselineRecord } from "../shared/types";

export function buildMerchantBaselines(
  snapshot: HistoricalAggregationSnapshot,
): MerchantBaselineRecord[] {
  const baselines: MerchantBaselineRecord[] = [];

  baselines.push({
    baselineType: "revenue",
    confidence: confidenceFromSignal(snapshot.orderCount, 10, 0.9),
    baselineJson: {
      totalRevenue: snapshot.totalRevenue,
      orderCount: snapshot.orderCount,
      averageOrderValue: snapshot.averageOrderValue,
      currencyNote: "store_currency",
    },
  });

  baselines.push({
    baselineType: "pricing",
    confidence: confidenceFromSignal(snapshot.productCount, 20, 0.85),
    baselineJson: {
      averageProductPrice: snapshot.averageProductPrice,
      productCount: snapshot.productCount,
      priceVolatilityEvidence: snapshot.evidenceByFactType.PriceChanged ?? 0,
    },
  });

  baselines.push({
    baselineType: "inventory",
    confidence: confidenceFromSignal(snapshot.totalInventoryUnits, 50, 0.88),
    baselineJson: {
      totalInventoryUnits: snapshot.totalInventoryUnits,
      lowStockSignals: snapshot.lowStockEvidenceCount,
      outOfStockSignals: snapshot.outOfStockEvidenceCount,
      activeProducts: snapshot.activeProductCount,
    },
  });

  baselines.push({
    baselineType: "category",
    confidence: confidenceFromSignal(snapshot.topProductTitles.length, 3, 0.7),
    baselineJson: {
      topProducts: snapshot.topProductTitles,
      concentrationRatio:
        snapshot.topProductTitles.length > 0
          ? round(
              snapshot.topProductTitles[0].count / Math.max(snapshot.productCount, 1),
              4,
            )
          : 0,
    },
  });

  baselines.push({
    baselineType: "vendor",
    confidence: 0.55,
    baselineJson: {
      note: "vendor_baseline_seeded_from_catalog_sample",
      productCount: snapshot.productCount,
    },
  });

  const weekendOrders =
    (snapshot.ordersByDayOfWeek[0]?.orderCount ?? 0) +
    (snapshot.ordersByDayOfWeek[6]?.orderCount ?? 0);
  const weekdayOrders = snapshot.ordersByDayOfWeek
    .filter((bucket) => bucket.dayOfWeek >= 1 && bucket.dayOfWeek <= 5)
    .reduce((sum, bucket) => sum + bucket.orderCount, 0);
  baselines.push({
    baselineType: "seasonality",
    confidence: snapshot.orderCount >= 30 ? 0.72 : 0.35,
    baselineJson: {
      ordersByDayOfWeek: snapshot.ordersByDayOfWeek,
      weekendOrderShare:
        snapshot.orderCount > 0 ? round(weekendOrders / snapshot.orderCount, 4) : 0,
      weekdayOrderShare:
        snapshot.orderCount > 0 ? round(weekdayOrders / snapshot.orderCount, 4) : 0,
    },
  });

  baselines.push({
    baselineType: "refund",
    confidence: snapshot.orderCount >= 20 ? 0.78 : 0.4,
    baselineJson: {
      refundRatio: snapshot.refundRatio,
      refundRiskEvidence: snapshot.evidenceByFactType.RefundRiskSeed ?? 0,
    },
  });

  const growthRate =
    snapshot.prior30DayRevenue > 0
      ? (snapshot.recent30DayRevenue - snapshot.prior30DayRevenue) /
        snapshot.prior30DayRevenue
      : snapshot.recent30DayRevenue > 0
        ? 1
        : 0;
  baselines.push({
    baselineType: "growth",
    confidence: snapshot.orderCount >= 40 ? 0.8 : 0.45,
    baselineJson: {
      recent30DayRevenue: snapshot.recent30DayRevenue,
      prior30DayRevenue: snapshot.prior30DayRevenue,
      growthRate: round(growthRate, 4),
    },
  });

  baselines.push({
    baselineType: "operational",
    confidence: confidenceFromSignal(snapshot.orderCount, 15, 0.82),
    baselineJson: {
      orderCount: snapshot.orderCount,
      averageOrderValue: snapshot.averageOrderValue,
      activeProductCount: snapshot.activeProductCount,
      evidenceFactTypesObserved: Object.keys(snapshot.evidenceByFactType).length,
    },
  });

  return baselines;
}

function confidenceFromSignal(value: number, threshold: number, max: number): number {
  return round(Math.min(max, 0.35 + (value / threshold) * 0.45));
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
