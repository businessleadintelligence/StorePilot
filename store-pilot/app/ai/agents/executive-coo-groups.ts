import type { ExecutiveCooEstimatedImpact, ExecutiveCooGroup } from "../schemas/executive-coo";
import { hasExecutiveCooDeterministicImpact } from "./executive-coo-impact";

export function assignExecutiveCooPriorityGroup(input: {
  focusArea: string;
  priorityScore: number;
  hasDeterministicImpact: boolean;
}): ExecutiveCooGroup {
  if (input.focusArea === "Inventory" || input.focusArea === "Fulfillment") {
    return input.priorityScore >= 70 ? "Inventory Stabilization" : "Critical Operations";
  }

  if (input.focusArea === "Revenue") {
    return input.priorityScore >= 65 ? "Revenue Recovery" : "Quick Wins";
  }

  if (input.focusArea === "Growth") {
    return "Growth Acceleration";
  }

  if (input.focusArea === "Product") {
    return "Product Optimization";
  }

  if (input.focusArea === "Marketing") {
    return "Marketing Efficiency";
  }

  if (input.focusArea === "Store Health") {
    return input.priorityScore >= 60 ? "Customer Experience" : "Critical Operations";
  }

  if (input.focusArea === "Risk Mitigation") {
    return "Critical Operations";
  }

  if (input.focusArea === "Strategic Planning") {
    return "Long-Term Strategy";
  }

  if (input.priorityScore >= 75 && input.hasDeterministicImpact) {
    return "Quick Wins";
  }

  if (input.priorityScore < 50) {
    return "Long-Term Strategy";
  }

  return "Critical Operations";
}

export function buildExecutiveCooFocusAreaGroups(
  priorities: Array<{ id: string; group: ExecutiveCooGroup }>,
) {
  return {
    criticalOperations: priorities
      .filter((item) => item.group === "Critical Operations")
      .map((item) => item.id),
    revenueRecovery: priorities.filter((item) => item.group === "Revenue Recovery").map((item) => item.id),
    inventoryStabilization: priorities
      .filter((item) => item.group === "Inventory Stabilization")
      .map((item) => item.id),
    growthAcceleration: priorities
      .filter((item) => item.group === "Growth Acceleration")
      .map((item) => item.id),
    productOptimization: priorities
      .filter((item) => item.group === "Product Optimization")
      .map((item) => item.id),
    customerExperience: priorities
      .filter((item) => item.group === "Customer Experience")
      .map((item) => item.id),
    marketingEfficiency: priorities
      .filter((item) => item.group === "Marketing Efficiency")
      .map((item) => item.id),
    quickWins: priorities.filter((item) => item.group === "Quick Wins").map((item) => item.id),
    longTermStrategy: priorities
      .filter((item) => item.group === "Long-Term Strategy")
      .map((item) => item.id),
  };
}

export function assignExecutiveCooPriorityGroupFromImpact(input: {
  focusArea: string;
  priorityScore: number;
  impact: ExecutiveCooEstimatedImpact;
}) {
  return assignExecutiveCooPriorityGroup({
    focusArea: input.focusArea,
    priorityScore: input.priorityScore,
    hasDeterministicImpact: hasExecutiveCooDeterministicImpact(input.impact),
  });
}

export { assignExecutiveCooGroupFromImpact } from "../tools/executive-group-tool";
