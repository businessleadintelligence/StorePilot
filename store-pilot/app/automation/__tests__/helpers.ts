import type { CreateAutomationInput } from "../../automation/automation-types";

export function buildCreateAutomationInput(
  overrides: Partial<CreateAutomationInput> = {},
): CreateAutomationInput {
  return {
    storeId: "store-test-001",
    title: "Create Fitness Starter Bundle",
    summary: "Automate bundle creation from approved operation",
    sourceType: "operation",
    sourceId: "operation:bundle-1",
    operationId: "operation:bundle-1",
    templateId: "create_bundle",
    products: ["Protein Powder", "Shaker Bottle"],
    revenueInfluenced: 18000,
    ...overrides,
  };
}

export function buildExecutableAutomationInput(
  overrides: Partial<CreateAutomationInput> = {},
): CreateAutomationInput {
  return buildCreateAutomationInput({
    title: "Update product tags for SEO",
    templateId: "update_product_tags",
    products: ["Protein Powder"],
    payload: {
      shopifyProductId: "gid://shopify/Product/1001",
      tags: { action: "replace", values: ["protein", "fitness", "bestseller"] },
      merchantId: "merchant-1",
    },
    ...overrides,
  });
}

export function buildEmptyAutomationCenterData() {
  return {
    pendingApprovals: [],
    automationQueue: [],
    executionTimeline: [],
    verificationQueue: [],
    automationHistory: [],
    riskAnalysis: [],
    metrics: {
      automationsPrepared: 0,
      automationsApproved: 0,
      approvalRate: 0,
      executionRate: 0,
      verificationRate: 0,
      merchantTimeSavedMinutes: 0,
      revenueInfluenced: 0,
      operationsAutomated: 0,
      merchantApprovalRate: 0,
    },
    charts: {
      successRate: [],
      approvalFunnel: [],
      executionTimeline: [],
      riskDistribution: [],
      automationTypes: [],
      verificationSuccess: [],
      automationHeatmap: [],
      timeSaved: [],
      roiDelivered: [],
      merchantApprovalRate: [],
    },
    notifications: [],
  };
}
