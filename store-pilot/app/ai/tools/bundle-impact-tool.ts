import type { BundleEstimatedImpact } from "../schemas/bundle-intelligence";

export function estimateBundleImpact(input: {
  bundleConfidence: number;
  attachRate: number;
  inventoryReduction: number;
  combinedPrice: number;
}): BundleEstimatedImpact {
  return {
    attachRateLift: Number(Math.min(0.5, input.attachRate * input.bundleConfidence * 0.2).toFixed(2)),
    inventoryUnitsReduced: input.inventoryReduction,
    bundleOrdersExpected: Math.max(1, Math.round(input.attachRate * 20 * input.bundleConfidence)),
    estimatedBundleValue: Number((input.combinedPrice * Math.max(1, input.attachRate * 10)).toFixed(2)),
  };
}

export function hasBundleDeterministicImpact(impact: BundleEstimatedImpact): boolean {
  return Object.values(impact).some((value) => value !== null && value !== undefined && value > 0);
}

export function calculateCombinedMarginScore(leftPrice: number | null, rightPrice: number | null): number {
  if (leftPrice == null || rightPrice == null || leftPrice <= 0 || rightPrice <= 0) {
    return 0.4;
  }

  const average = (leftPrice + rightPrice) / 2;
  return Number(Math.min(1, average / 100).toFixed(2));
}

export function calculateBundleComplexity(productCount: number): "simple" | "moderate" | "complex" {
  if (productCount <= 2) {
    return "simple";
  }

  if (productCount === 3) {
    return "moderate";
  }

  return "complex";
}

export function passesBundleSafetyConstraints(input: {
  productCount: number;
  inventoryCompatible: boolean;
  confidence: number;
}): boolean {
  return input.productCount >= 2 && input.productCount <= 4 && input.inventoryCompatible && input.confidence >= 0.45;
}
