import type { FeatureGateViewModel } from "../billing/billing-types";
import type { FeatureAvailability } from "../billing/plan-registry";

export function toFeatureGateViewModel(
  availability: FeatureAvailability,
): FeatureGateViewModel {
  return {
    available: availability.available,
    featureName: availability.featureName,
    upgradeText: availability.upgradeText,
    minimumPlanName: availability.minimumPlanName,
    upgradeTargetPlan: availability.upgradeTargetPlan,
    upgradePriceUsd: availability.upgradePriceUsd,
    currentPlanName: availability.currentPlanName,
  };
}

export function serializeFeatureGateViewModel(
  model: FeatureGateViewModel,
): FeatureGateViewModel {
  return JSON.parse(JSON.stringify(model)) as FeatureGateViewModel;
}
