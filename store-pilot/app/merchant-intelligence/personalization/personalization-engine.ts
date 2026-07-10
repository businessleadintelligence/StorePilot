import type {
  MerchantBehaviorRecord,
  PersonalizationRecord,
} from "../shared/types";

const ALL_DOMAINS = [
  "seo",
  "inventory",
  "collections",
  "pricing",
  "operations",
  "merchandising",
  "content",
  "bundles",
];

export function buildPersonalizationProfile(
  behavior: MerchantBehaviorRecord,
): PersonalizationRecord {
  const deprioritized: string[] = [];
  const prioritized: string[] = [];

  if (behavior.acceptsPricingChanges < 0.4) deprioritized.push("pricing");
  else prioritized.push("pricing");

  if (behavior.rejectsInventoryChanges > 0.6) deprioritized.push("inventory");
  else prioritized.push("inventory");

  if (behavior.ignoresSeo > 0.6) deprioritized.push("seo");
  else prioritized.push("seo");

  prioritized.push("collections", "merchandising");
  if (behavior.prefersOperationalEfficiency > 0.6) prioritized.push("operations");

  const uniquePriority = [...new Set(prioritized.filter((d) => !deprioritized.includes(d)))];
  const uniqueDeprioritized = [...new Set(deprioritized)];

  return {
    priorityDomains: uniquePriority.length > 0 ? uniquePriority : ["seo", "inventory", "collections"],
    deprioritizedDomains: uniqueDeprioritized,
    decisionStyle: behavior.actsQuickly > 0.6 ? "decisive" : behavior.delaysDecisions > 0.6 ? "cautious" : "balanced",
    riskTolerance: behavior.prefersLowRisk > 0.6 ? "low" : behavior.prefersLongTermGrowth > 0.6 ? "high" : "medium",
    automationReadiness: behavior.prefersAutomation,
  };
}

export function reorderDomainsForMerchant(domains: string[], profile: PersonalizationRecord): string[] {
  const deprioritized = new Set(profile.deprioritizedDomains);
  const priority = new Set(profile.priorityDomains);
  return [
    ...domains.filter((d) => priority.has(d)),
    ...domains.filter((d) => !priority.has(d) && !deprioritized.has(d)),
    ...domains.filter((d) => deprioritized.has(d)),
  ];
}

export { ALL_DOMAINS };
