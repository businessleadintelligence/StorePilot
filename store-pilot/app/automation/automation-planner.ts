import type { StoreOperation } from "../operations/operations-types";
import type { CreateAutomationInput } from "./automation-types";
import { inferAutomationTemplateId } from "./automation-templates";

export function buildAutomationFromOperation(operation: StoreOperation): CreateAutomationInput {
  return {
    storeId: operation.storeId,
    title: `Automate: ${operation.title}`,
    summary: operation.summary,
    sourceType: "operation",
    sourceId: operation.id,
    operationId: operation.id,
    templateId: inferAutomationTemplateId({
      title: operation.title,
      category: operation.templateId,
      operationTemplateId: operation.templateId,
    }),
    products: [],
    revenueInfluenced: operation.expectedRevenueImpact,
  };
}

export function planAutomationSteps(templateId: string): string[] {
  switch (templateId) {
    case "create_bundle":
      return ["Validate products", "Generate bundle preview", "Prepare rollback plan", "Queue for approval"];
    case "schedule_discount":
      return ["Validate pricing rules", "Build discount preview", "Assess risk", "Queue for approval"];
    case "generate_seo_metadata":
      return ["Analyze product copy", "Draft SEO metadata", "Build preview", "Queue for approval"];
    default:
      return ["Build preview", "Assess risk", "Prepare rollback", "Queue for approval"];
  }
}

export function shouldPrepareFromOperation(operation: StoreOperation): boolean {
  return ["approved", "in_progress", "verification", "completed", "verified"].includes(operation.status);
}

export function rankAutomationQueue<T extends { riskLevel: string; createdAt: string }>(
  automations: T[],
): T[] {
  const riskOrder = { critical: 4, high: 3, medium: 2, low: 1 };
  return [...automations].sort((left, right) => {
    const riskDelta =
      (riskOrder[right.riskLevel as keyof typeof riskOrder] ?? 0) -
      (riskOrder[left.riskLevel as keyof typeof riskOrder] ?? 0);
    if (riskDelta !== 0) return riskDelta;
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
}
