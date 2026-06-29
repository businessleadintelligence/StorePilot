import type { ExecutiveCooGroup, ExecutiveCooEstimatedImpact } from "../schemas/executive-coo";

export function assignExecutiveCooGroupFromImpact(input: {
  focusArea: string;
  priorityScore: number;
  impact: ExecutiveCooEstimatedImpact;
}): ExecutiveCooGroup {
  if (input.focusArea === "Inventory" || input.focusArea === "Fulfillment") {
    return "Inventory Stabilization";
  }

  if (input.focusArea === "Revenue") {
    return input.priorityScore >= 75 ? "Revenue Recovery" : "Critical Operations";
  }

  if (input.focusArea === "Growth" || input.focusArea === "Marketing") {
    return "Growth Acceleration";
  }

  if (input.focusArea === "Product") {
    return "Product Optimization";
  }

  if (input.focusArea === "Store Health") {
    return "Customer Experience";
  }

  if ((input.impact.revenueOpportunity ?? 0) >= 5000) {
    return "Quick Wins";
  }

  return input.priorityScore >= 70 ? "Long-Term Strategy" : "Critical Operations";
}

export function assignExecutiveGroup(input: {
  category: string;
  group?: string;
  priorityScore: number;
  automationReady?: boolean;
  blocked?: boolean;
  impact?: ExecutiveCooEstimatedImpact;
}): ExecutiveCooGroup {
  if (input.group && isExecutiveCooGroup(input.group)) {
    return input.group;
  }

  return assignExecutiveCooGroupFromImpact({
    focusArea: input.category,
    priorityScore: input.priorityScore,
    impact: input.impact ?? {},
  });
}

function isExecutiveCooGroup(value: string): value is ExecutiveCooGroup {
  return [
    "Critical Operations",
    "Revenue Recovery",
    "Inventory Stabilization",
    "Growth Acceleration",
    "Product Optimization",
    "Customer Experience",
    "Marketing Efficiency",
    "Quick Wins",
    "Long-Term Strategy",
  ].includes(value);
}

export function buildExecutiveCooFocusAreaGroups(
  priorities: Array<{ id: string; group: ExecutiveCooGroup }>,
) {
  const groups = {
    criticalOperations: [] as string[],
    revenueRecovery: [] as string[],
    inventoryStabilization: [] as string[],
    growthAcceleration: [] as string[],
    productOptimization: [] as string[],
    customerExperience: [] as string[],
    marketingEfficiency: [] as string[],
    quickWins: [] as string[],
    longTermStrategy: [] as string[],
  };

  for (const priority of priorities) {
    switch (priority.group) {
      case "Critical Operations":
        groups.criticalOperations.push(priority.id);
        break;
      case "Revenue Recovery":
        groups.revenueRecovery.push(priority.id);
        break;
      case "Inventory Stabilization":
        groups.inventoryStabilization.push(priority.id);
        break;
      case "Growth Acceleration":
        groups.growthAcceleration.push(priority.id);
        break;
      case "Product Optimization":
        groups.productOptimization.push(priority.id);
        break;
      case "Customer Experience":
        groups.customerExperience.push(priority.id);
        break;
      case "Marketing Efficiency":
        groups.marketingEfficiency.push(priority.id);
        break;
      case "Quick Wins":
        groups.quickWins.push(priority.id);
        break;
      case "Long-Term Strategy":
        groups.longTermStrategy.push(priority.id);
        break;
      default:
        groups.criticalOperations.push(priority.id);
    }
  }

  return groups;
}

export const buildExecutiveCooRecommendationGroups = buildExecutiveCooFocusAreaGroups;
export const buildExecutiveGroups = buildExecutiveCooFocusAreaGroups;
