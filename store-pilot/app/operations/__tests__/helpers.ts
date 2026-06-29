import type { CreateOperationInput } from "../../operations/operations-types";

export function buildCreateOperationInput(
  overrides: Partial<CreateOperationInput> = {},
): CreateOperationInput {
  return {
    storeId: "store-1",
    title: "Launch Fitness Starter Bundle",
    summary: "Coordinate bundle launch across inventory, trend, and merchandising signals",
    sourceType: "executive_decision",
    sourceId: "executive:fitness-starter-bundle",
    sourceRecommendationIds: ["trend:restock-protein", "bundle:fitness-starter"],
    agentsInvolved: ["trend_intelligence", "bundle_discovery", "inventory_intelligence"],
    templateId: "bundle_launch",
    priority: "critical",
    difficulty: "Medium",
    estimatedMinutes: 45,
    expectedRevenueImpact: 18000,
    expectedInventoryImpact: 1200,
    ...overrides,
  };
}

export function buildEmptyOperationsCenterData() {
  return {
    inbox: {
      waitingApproval: [],
      inProgress: [],
      blocked: [],
      needsVerification: [],
      completedToday: [],
      overdue: [],
    },
    queue: [],
    kanban: {
      planned: [],
      approved: [],
      in_progress: [],
      blocked: [],
      verification: [],
      completed: [],
    },
    calendar: { today: [], tomorrow: [], thisWeek: [], later: [] },
    verificationQueue: [],
    metrics: {
      executionRate: 0,
      completionRate: 0,
      verificationSuccessRate: 0,
      averageCompletionMinutes: 0,
      revenueGenerated: 0,
      inventoryReduced: 0,
      merchantProductivity: 0,
    },
    charts: {
      burnDown: [],
      completionVelocity: [],
      verificationFunnel: [],
      executionHeatmap: [],
      kanbanFlow: [],
      revenueDelivered: [],
      timeAllocation: [],
      productivityTrend: [],
      capacityGauge: [],
      weeklyProgress: [],
    },
    history: [],
    notifications: [],
    achievements: [],
    todayOperations: [],
  };
}
