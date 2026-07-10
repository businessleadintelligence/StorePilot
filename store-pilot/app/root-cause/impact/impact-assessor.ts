import type { RootCauseSeverity } from "@prisma/client";

import { PROFIT_MARGIN_ESTIMATE } from "../shared/constants";
import type { ImpactEstimate, RootCauseRecord } from "../shared/types";

export function assessImpact(input: {
  revenueOpportunity: number;
  urgency: number;
  confidence: number;
  affectedEvidenceCount: number;
}): ImpactEstimate {
  const revenueImpact = roundCurrency(input.revenueOpportunity || input.affectedEvidenceCount * 25);
  const operationalImpact = Math.min(100, Math.round(input.urgency * 0.8 + input.affectedEvidenceCount * 2));
  const customerImpact = Math.min(100, Math.round(input.confidence * 60 + input.affectedEvidenceCount));
  const urgency = Math.min(100, Math.round(input.urgency + input.confidence * 20));

  return {
    revenueImpact,
    profitImpact: roundCurrency(revenueImpact * PROFIT_MARGIN_ESTIMATE),
    operationalImpact,
    customerImpact,
    urgency,
  };
}

export function severityFromConfidence(confidence: number): RootCauseSeverity {
  if (confidence >= 0.9) {
    return "critical";
  }
  if (confidence >= 0.75) {
    return "high";
  }
  if (confidence >= 0.55) {
    return "medium";
  }
  return "low";
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

export function summarizeImpactForRecords(records: RootCauseRecord[]): ImpactEstimate {
  return records.reduce<ImpactEstimate>(
    (sum, record) => ({
      revenueImpact: sum.revenueImpact + record.impactEstimate.revenueImpact,
      profitImpact: sum.profitImpact + record.impactEstimate.profitImpact,
      operationalImpact: Math.max(sum.operationalImpact, record.impactEstimate.operationalImpact),
      customerImpact: Math.max(sum.customerImpact, record.impactEstimate.customerImpact),
      urgency: Math.max(sum.urgency, record.impactEstimate.urgency),
    }),
    {
      revenueImpact: 0,
      profitImpact: 0,
      operationalImpact: 0,
      customerImpact: 0,
      urgency: 0,
    },
  );
}
