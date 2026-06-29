import type { AutomationTemplate } from "./automation-templates";
import type { AutomationRiskLevel, CreateAutomationInput } from "./automation-types";
import { getAutomationTemplate } from "./automation-templates";

export function assessAutomationRisk(input: {
  template: AutomationTemplate;
  products: string[];
  createInput: CreateAutomationInput;
}): { riskLevel: AutomationRiskLevel; riskFactors: string[] } {
  const factors: string[] = [];
  let score = 0;

  if (input.products.length > 0) {
    factors.push(`${input.products.length} product(s) affected`);
    score += input.products.length >= 3 ? 2 : 1;
  }

  if (input.template.category === "Pricing") {
    factors.push("Pricing affected");
    score += 3;
  }
  if (input.template.category === "SEO") {
    factors.push("SEO affected");
    score += 1;
  }
  if (input.template.id === "create_bundle") {
    factors.push("Inventory and catalog structure affected");
    score += 2;
  }
  if ((input.createInput.revenueInfluenced ?? 0) > 10000) {
    factors.push("High revenue influence");
    score += 1;
  }

  const riskLevel: AutomationRiskLevel =
    score >= 5 ? "critical" : score >= 4 ? "high" : score >= 2 ? "medium" : "low";

  return { riskLevel, riskFactors: factors };
}

export function buildRollbackPlan(input: {
  template: AutomationTemplate;
  products: string[];
  payload?: Record<string, unknown>;
}) {
  return {
    beforeState: {
      products: input.products,
      payload: input.payload ?? {},
      status: "unchanged",
    },
    afterState: {
      products: input.products,
      expectedChanges: input.template.expectedChanges,
      status: "planned_only",
    },
    rollbackSteps: input.template.rollbackSteps,
  };
}

export function requiresExplicitApproval(riskLevel: AutomationRiskLevel): true {
  void riskLevel;
  return true;
}

export function riskWeight(riskLevel: AutomationRiskLevel): number {
  switch (riskLevel) {
    case "critical":
      return 4;
    case "high":
      return 3;
    case "medium":
      return 2;
    default:
      return 1;
  }
}

export function assessTemplateRisk(templateId: string, products: string[]) {
  const template = getAutomationTemplate(templateId);
  return assessAutomationRisk({
    template,
    products,
    createInput: { storeId: "", title: template.name, sourceType: "operation", sourceId: template.id },
  });
}
