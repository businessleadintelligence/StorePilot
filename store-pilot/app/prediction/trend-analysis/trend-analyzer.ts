import type { ContributingSignal, PredictionContextBundle } from "../shared/types";

const SIGNAL_MAP: Record<string, string[]> = {
  inventory_down: ["OutOfStock", "InventoryLow", "InventoryCritical"],
  seo_down: ["MissingSEO", "MissingMetaDescription", "MissingAltText"],
  pricing_anomaly: ["PriceAboveCategoryAverage", "MarginRiskCandidate", "PriceChanged"],
  refund_up: ["RefundRiskSeed"],
  collection_issue: ["OrphanCollection", "SingleProductCollection"],
  revenue_down: [],
  revenue_up: [],
};

export function extractTrendSignals(
  context: PredictionContextBundle,
): ContributingSignal[] {
  const signals: ContributingSignal[] = [];

  for (const [signalKey, factTypes] of Object.entries(SIGNAL_MAP)) {
    if (factTypes.length === 0) {
      continue;
    }
    let count = 0;
    const evidenceIds: string[] = [];
    for (const factType of factTypes) {
      const group = context.evidenceGroups.get(factType);
      if (group) {
        count += group.count;
        evidenceIds.push(...group.evidenceIds);
      }
    }
    if (count === 0) {
      continue;
    }
    signals.push({
      signalKey,
      domain: signalKey.split("_")[0] ?? "general",
      magnitude: count,
      direction: signalKey.endsWith("_down") || signalKey.endsWith("_up")
        ? signalKey.endsWith("_down")
          ? "down"
          : "up"
        : "stable",
    });
  }

  const revenueBaseline = context.merchantBaselines.find(
    (b) => b.baselineType === "revenue",
  );
  if (revenueBaseline) {
    const recent = Number(revenueBaseline.baselineJson.recent30DayRevenue ?? 0);
    const prior = Number(revenueBaseline.baselineJson.prior30DayRevenue ?? 0);
    if (prior > 0 && recent !== prior) {
      signals.push({
        signalKey: recent >= prior ? "revenue_up" : "revenue_down",
        domain: "revenue",
        magnitude: Math.abs((recent - prior) / prior),
        direction: recent >= prior ? "up" : "down",
      });
    }
  }

  for (const seed of context.patternSeeds) {
    if (seed.patternType === "inventory_pressure") {
      signals.push({
        signalKey: "inventory_down",
        domain: "inventory",
        magnitude: seed.confidence,
        direction: "down",
      });
    }
    if (seed.patternType === "high_refund_rate") {
      signals.push({
        signalKey: "refund_up",
        domain: "operations",
        magnitude: seed.confidence,
        direction: "up",
      });
    }
  }

  return dedupeSignals(signals);
}

function dedupeSignals(signals: ContributingSignal[]): ContributingSignal[] {
  const map = new Map<string, ContributingSignal>();
  for (const signal of signals) {
    const existing = map.get(signal.signalKey);
    if (!existing || signal.magnitude > existing.magnitude) {
      map.set(signal.signalKey, signal);
    }
  }
  return [...map.values()];
}

export function hasRequiredSignals(
  required: string[],
  active: Set<string>,
): boolean {
  return required.every((signal) => active.has(signal));
}
