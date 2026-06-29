import type { StoreAutomation } from "./automation-types";
import { executeShopifyAutomation, type ShopifyExecutorDependencies } from "../shopify-automation/shopify-executor";
import type { AutomationExecutionResult } from "../shopify-automation/execution-result";

export type { AutomationExecutionResult };

export async function executeAutomationPlan(
  automation: StoreAutomation,
  dependencies?: ShopifyExecutorDependencies,
): Promise<AutomationExecutionResult> {
  if (!automation.merchantApproved) {
    throw new Error("merchant_approval_required");
  }

  if (!["approved", "executing", "executed"].includes(automation.status)) {
    throw new Error("automation_not_approved");
  }

  return executeShopifyAutomation(automation, dependencies);
}

export function executionRequiresApproval(): true {
  return true;
}
