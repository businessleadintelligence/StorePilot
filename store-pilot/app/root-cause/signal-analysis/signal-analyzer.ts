import {
  PATTERN_SIGNAL_MAP,
  SIGNAL_FACT_MAP,
} from "../shared/constants";
import type { RootCauseContextBundle, SignalSnapshot } from "../shared/types";

export function analyzeSignals(context: RootCauseContextBundle): SignalSnapshot[] {
  const signals: SignalSnapshot[] = [];

  for (const [signalKey, factTypes] of Object.entries(SIGNAL_FACT_MAP)) {
    const evidenceIds: string[] = [];
    let totalCount = 0;

    for (const factType of factTypes) {
      const group = context.evidenceGroups.get(factType);
      if (!group || group.count === 0) {
        continue;
      }
      totalCount += group.count;
      evidenceIds.push(...group.evidenceIds);
    }

    if (totalCount === 0) {
      continue;
    }

    signals.push({
      signalKey,
      domain: signalKey.split("_")[0] ?? "general",
      direction: signalKey.endsWith("_down") || signalKey.endsWith("_up")
        ? signalKey.endsWith("_down")
          ? "down"
          : "up"
        : "stable",
      magnitude: totalCount,
      evidenceIds: [...new Set(evidenceIds)],
      factTypes,
      source: "evidence",
    });
  }

  for (const seed of context.patternSeeds) {
    const signalKey = PATTERN_SIGNAL_MAP[seed.semanticLabel] ?? PATTERN_SIGNAL_MAP[seed.patternType];
    if (!signalKey) {
      continue;
    }

    const growthRate =
      typeof seed.patternJson.growthRate === "number" ? seed.patternJson.growthRate : 0;

    signals.push({
      signalKey,
      domain: signalKey.split("_")[0] ?? "pattern",
      direction: growthRate < 0 ? "down" : growthRate > 0 ? "up" : "stable",
      magnitude: Math.abs(growthRate) || seed.confidence,
      evidenceIds: [],
      factTypes: [],
      source: "pattern",
    });
  }

  const revenueBaseline = context.merchantBaselines.find(
    (baseline) => baseline.baselineType === "revenue",
  );
  if (revenueBaseline) {
    const recent =
      typeof revenueBaseline.baselineJson.recent30DayRevenue === "number"
        ? revenueBaseline.baselineJson.recent30DayRevenue
        : 0;
    const prior =
      typeof revenueBaseline.baselineJson.prior30DayRevenue === "number"
        ? revenueBaseline.baselineJson.prior30DayRevenue
        : 0;
    if (prior > 0 && recent !== prior) {
      signals.push({
        signalKey: recent >= prior ? "revenue_up" : "revenue_down",
        domain: "revenue",
        direction: recent >= prior ? "up" : "down",
        magnitude: Math.abs((recent - prior) / prior),
        evidenceIds: [],
        factTypes: [],
        source: "baseline",
      });
    }
  }

  return dedupeSignals(signals);
}

function dedupeSignals(signals: SignalSnapshot[]): SignalSnapshot[] {
  const byKey = new Map<string, SignalSnapshot>();
  for (const signal of signals) {
    const existing = byKey.get(signal.signalKey);
    if (!existing || signal.magnitude > existing.magnitude) {
      byKey.set(signal.signalKey, signal);
    }
  }
  return [...byKey.values()];
}

export function getActiveSignalKeys(signals: SignalSnapshot[]): Set<string> {
  return new Set(signals.map((signal) => signal.signalKey));
}
