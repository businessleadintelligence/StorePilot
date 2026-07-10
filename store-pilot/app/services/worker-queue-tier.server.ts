import { getWorkerQueueTier, normalizePlanSlug } from "../billing/plan-registry";
import { getStoreEntitlements } from "./store-entitlements-loader.server";

export type WorkerQueueAssignment = {
  tier: "standard" | "normal" | "priority";
  planSlug: string;
};

export async function resolveWorkerQueueAssignment(
  storeId: string,
): Promise<WorkerQueueAssignment> {
  const entitlements = await getStoreEntitlements(storeId);
  const planSlug = normalizePlanSlug(entitlements?.planSlug);
  return {
    planSlug,
    tier: getWorkerQueueTier(planSlug),
  };
}
