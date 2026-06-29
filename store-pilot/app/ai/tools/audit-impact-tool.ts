import type { StoreAuditEstimatedImpact } from "../schemas/store-audit-intelligence";

export function estimateAuditImpact(input: {
  category: string;
  confidence: number;
  sectionScore: number;
}): StoreAuditEstimatedImpact {
  const lift = Number(((100 - input.sectionScore) * input.confidence * 0.15).toFixed(2));
  return {
    conversionLift: input.category === "Conversion Optimization" ? lift : null,
    seoLift: input.category === "SEO" ? lift : null,
    performanceGain:
      input.category === "Theme" || input.category === "Apps" ? Math.round(lift * 10) : null,
    accessibilityImprovement: input.category === "Accessibility" ? Math.round(lift * 5) : null,
  };
}

export function hasAuditDeterministicImpact(impact: StoreAuditEstimatedImpact): boolean {
  return Object.values(impact).some((value) => value !== null && value !== undefined && value > 0);
}
