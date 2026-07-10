/**
 * Server-side feature gate helpers — derive from plan registry only.
 */

import { getStoreEntitlements } from "../services/store-entitlements-loader.server";
import {
  getFeatureAvailability,
  isFeatureAvailable,
  normalizePlanSlug,
  type FeatureAvailability,
  type FeatureKey,
} from "./plan-registry";

export {
  getFeatureAvailability,
  isFeatureAvailable,
  normalizePlanSlug,
  type FeatureAvailability,
  type FeatureKey,
};

export async function getStoreFeatureAvailability(
  storeId: string,
  feature: FeatureKey,
): Promise<FeatureAvailability> {
  const entitlements = await getStoreEntitlements(storeId);
  const planSlug = normalizePlanSlug(entitlements?.planSlug);
  return getFeatureAvailability(planSlug, feature);
}

export async function isStoreFeatureAvailable(
  storeId: string,
  feature: FeatureKey,
): Promise<boolean> {
  const availability = await getStoreFeatureAvailability(storeId, feature);
  return availability.available;
}
