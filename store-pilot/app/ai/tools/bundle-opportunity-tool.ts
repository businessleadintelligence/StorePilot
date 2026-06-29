export type BundleOpportunityType =
  | "starter_kit"
  | "accessory_bundle"
  | "quantity_bundle"
  | "seasonal_bundle"
  | "dead_inventory_bundle"
  | "high_margin_bundle"
  | "merchandising_bundle";

export function classifyBundleOpportunity(input: {
  attachRate: number;
  leftVelocity: number;
  rightVelocity: number;
  leftAgingDays: number;
  rightAgingDays: number;
  combinedMarginScore: number;
  sharedRelationshipCount: number;
}): BundleOpportunityType {
  const slowLeft = input.leftVelocity < 0.2 && input.leftAgingDays >= 60;
  const slowRight = input.rightVelocity < 0.2 && input.rightAgingDays >= 60;

  if (slowLeft || slowRight) {
    return "dead_inventory_bundle";
  }

  if (input.combinedMarginScore >= 0.7) {
    return "high_margin_bundle";
  }

  if (input.sharedRelationshipCount >= 2 && input.attachRate >= 0.35) {
    return "starter_kit";
  }

  if (input.attachRate >= 0.25) {
    return "accessory_bundle";
  }

  if (input.leftVelocity > 0.5 && input.rightVelocity > 0.5) {
    return "quantity_bundle";
  }

  return "merchandising_bundle";
}

export function estimatePotentialInventoryReduction(input: {
  slowProductInventory: number;
  bundleConfidence: number;
}): number {
  return Math.round(input.slowProductInventory * input.bundleConfidence * 0.35);
}

export function estimatePotentialAttachRate(input: {
  currentAttachRate: number;
  bundleConfidence: number;
}): number {
  return Number(Math.min(0.95, input.currentAttachRate + input.bundleConfidence * 0.15).toFixed(2));
}
