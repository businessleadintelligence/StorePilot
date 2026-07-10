import type { CausalRelationType } from "@prisma/client";

import type { SignalCorrelationRecord, SignalSnapshot } from "../shared/types";

export function computeSignalCorrelations(
  signals: SignalSnapshot[],
): SignalCorrelationRecord[] {
  const correlations: SignalCorrelationRecord[] = [];

  for (let i = 0; i < signals.length; i += 1) {
    for (let j = i + 1; j < signals.length; j += 1) {
      const left = signals[i]!;
      const right = signals[j]!;
      const relationType = inferRelationType(left, right);
      const strength = computeCorrelationStrength(left, right);

      if (strength < 0.35) {
        continue;
      }

      correlations.push({
        correlationKey: `${left.signalKey}:${right.signalKey}`,
        signalA: left.signalKey,
        signalB: right.signalKey,
        relationType,
        strength,
        evidenceIds: [...new Set([...left.evidenceIds, ...right.evidenceIds])],
      });
    }
  }

  return correlations.sort((a, b) => b.strength - a.strength);
}

function inferRelationType(
  left: SignalSnapshot,
  right: SignalSnapshot,
): CausalRelationType {
  if (left.domain !== right.domain) {
    return "cross_domain";
  }
  if (left.direction === right.direction) {
    return "positive";
  }
  if (left.direction === "down" && right.direction === "up") {
    return "inverse";
  }
  return "negative";
}

function computeCorrelationStrength(
  left: SignalSnapshot,
  right: SignalSnapshot,
): number {
  const magnitudeFactor = Math.min(1, (left.magnitude + right.magnitude) / 20);
  const directionFactor =
    left.direction === right.direction
      ? 0.85
      : left.direction === "stable" || right.direction === "stable"
        ? 0.55
        : 0.7;
  const domainFactor = left.domain === right.domain ? 1 : 0.75;
  return round(Math.min(0.98, magnitudeFactor * directionFactor * domainFactor));
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}
