export function calculateBundleConfidence(input: {
  attachRate: number;
  coPurchaseCount: number;
  sharedRelationshipCount: number;
  inventoryCompatible: boolean;
}): number {
  let score = input.attachRate * 0.45 + Math.min(1, input.coPurchaseCount / 10) * 0.25;
  score += Math.min(1, input.sharedRelationshipCount / 3) * 0.2;
  if (input.inventoryCompatible) {
    score += 0.1;
  }

  return Math.max(0, Math.min(1, Number(score.toFixed(2))));
}

export function passesMinimumBundleConfidence(confidence: number, minimum = 0.45): boolean {
  return confidence >= minimum;
}
