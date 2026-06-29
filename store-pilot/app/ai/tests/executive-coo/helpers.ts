import {
  createExecutiveCooFactsBuilder,
  type ExecutiveCooAgentSnapshot,
  type ExecutiveCooFacts,
  type ExecutiveCooSpecialistRecommendation,
} from "../../facts/executive-coo-facts";
import type { ExecutiveCooOutput } from "../../schemas/executive-coo";
import defaultExecutiveCooFacts from "./default-executive-coo-facts.json";

type ExecutiveCooSnapshot = NonNullable<
  Awaited<ReturnType<ExecutiveCooFactsSource["getExecutiveCooSnapshot"]>>
>;
type ExecutiveCooFactsSource = Parameters<typeof createExecutiveCooFactsBuilder>[0];

const DEFAULT_AGENT_SNAPSHOTS: ExecutiveCooAgentSnapshot[] = [
  {
    agentId: "inventory_intelligence",
    summary: "Inventory coverage is stable with one low-stock alert.",
    confidence: 0.86,
    healthScore: 72,
    riskScore: 38,
    openRecommendationCount: 1,
    createdAt: "2026-06-19T08:00:00.000Z",
    ageHours: 18,
  },
  {
    agentId: "growth_intelligence",
    summary: "Growth momentum is positive with retention headroom.",
    confidence: 0.84,
    healthScore: 68,
    riskScore: 32,
    openRecommendationCount: 1,
    createdAt: "2026-06-19T09:00:00.000Z",
    ageHours: 16,
  },
  {
    agentId: "store_audit",
    summary: "Store health baseline is acceptable with conversion gaps.",
    confidence: 0.82,
    healthScore: 74,
    riskScore: 28,
    openRecommendationCount: 1,
    createdAt: "2026-06-19T07:00:00.000Z",
    ageHours: 20,
  },
  {
    agentId: "pricing_intelligence",
    summary: "Pricing posture supports margin recovery actions.",
    confidence: 0.8,
    healthScore: 70,
    riskScore: 30,
    openRecommendationCount: 1,
    createdAt: "2026-06-19T06:00:00.000Z",
    ageHours: 22,
  },
];

const DEFAULT_SPECIALIST_RECOMMENDATIONS: ExecutiveCooSpecialistRecommendation[] = [
  {
    recommendationId: "inventory:replenish-hero-skus",
    agentId: "inventory_intelligence",
    title: "Replenish hero SKUs before campaign push",
    reason: "Low stock on high-velocity products increases stockout risk during promotions.",
    category: "Inventory",
    priority: 2,
    confidence: 0.88,
    status: "open",
  },
  {
    recommendationId: "growth:retention-winback",
    agentId: "growth_intelligence",
    title: "Launch repeat-buyer win-back sequence",
    reason: "Returning customer rate is below target for sustainable revenue expansion.",
    category: "Retention",
    priority: 2,
    confidence: 0.86,
    status: "open",
  },
  {
    recommendationId: "pricing:margin-recovery",
    agentId: "pricing_intelligence",
    title: "Reduce discount depth on premium SKUs",
    reason: "Premium products show room to recover margin without sacrificing velocity.",
    category: "Revenue",
    priority: 3,
    confidence: 0.83,
    status: "viewed",
  },
];

export function createMockExecutiveCooSnapshot(
  overrides: Partial<ExecutiveCooSnapshot> = {},
): ExecutiveCooSnapshot {
  return {
    storeName: overrides.storeName ?? "Acme Outfitters",
    estimatedMarginPercent: overrides.estimatedMarginPercent ?? 42,
    totalRevenue30: overrides.totalRevenue30 ?? 12500,
    totalRevenue90: overrides.totalRevenue90 ?? 34200,
    previousRevenue30: overrides.previousRevenue30 ?? 11000,
    totalOrders30: overrides.totalOrders30 ?? 48,
    storeHealthScore: overrides.storeHealthScore ?? 74,
    outOfStockProducts: overrides.outOfStockProducts ?? 0,
    agentSnapshots: overrides.agentSnapshots ?? DEFAULT_AGENT_SNAPSHOTS,
    specialistRecommendations:
      overrides.specialistRecommendations ?? DEFAULT_SPECIALIST_RECOMMENDATIONS,
    implementedPriorityIds: overrides.implementedPriorityIds ?? [],
    dismissedPriorityIds: overrides.dismissedPriorityIds ?? [],
    collaborationSummary:
      overrides.collaborationSummary ??
      "Specialists align on stabilizing inventory before scaling acquisition.",
    collaborationConflicts: overrides.collaborationConflicts ?? [],
    collaborationDependencies: overrides.collaborationDependencies ?? [
      {
        recommendationId: "growth:retention-winback",
        dependsOn: ["inventory:replenish-hero-skus"],
        reason: "inventory_prerequisite",
      },
    ],
    operations: overrides.operations ?? [
      {
        id: "op-replenish",
        title: "Replenish hero SKUs",
        status: "pending",
        blockedReason: null,
        estimatedMinutes: 90,
        priorityScore: 82,
        verifiedAt: null,
      },
      {
        id: "op-pricing-review",
        title: "Review premium SKU discount depth",
        status: "in_progress",
        blockedReason: null,
        estimatedMinutes: 60,
        priorityScore: 74,
        verifiedAt: null,
      },
    ],
    automations: overrides.automations ?? [
      { id: "auto-low-stock", title: "Low stock alert routing", status: "approved" },
    ],
    merchantLearning: overrides.merchantLearning ?? {
      preferredBatchSize: 4,
      averageCompletionMinutes: 45,
    },
    storeMetrics: overrides.storeMetrics ?? {
      storeHealthScore: 74,
      revenueOpportunity: 18200,
      inventoryRisk: 42,
      growthScore: 68,
    },
  };
}

export async function buildExecutiveCooFactsFromSnapshot(
  snapshot = createMockExecutiveCooSnapshot(),
  storeId = "store-1",
): Promise<ExecutiveCooFacts> {
  const builder = createExecutiveCooFactsBuilder({
    async getExecutiveCooSnapshot() {
      return snapshot;
    },
  });

  return builder.build({ storeId, agentId: "executive_coo" });
}

const cachedDefaultFacts = defaultExecutiveCooFacts as ExecutiveCooFacts;

export function buildMockExecutiveCooFacts(
  overrides: Partial<ExecutiveCooFacts> = {},
): ExecutiveCooFacts {
  return {
    ...cachedDefaultFacts,
    ...overrides,
    merchantCapacity: {
      ...cachedDefaultFacts.merchantCapacity,
      ...(overrides.merchantCapacity ?? {}),
    },
    executionCapacity: {
      ...cachedDefaultFacts.executionCapacity,
      ...(overrides.executionCapacity ?? {}),
    },
    strategySignals: {
      ...cachedDefaultFacts.strategySignals,
      ...(overrides.strategySignals ?? {}),
    },
    merchantOperationalPreferences: {
      ...cachedDefaultFacts.merchantOperationalPreferences,
      ...(overrides.merchantOperationalPreferences ?? {}),
    },
    storeTotals: {
      ...cachedDefaultFacts.storeTotals,
      ...(overrides.storeTotals ?? {}),
    },
  };
}

export function buildValidExecutiveCooDraft(
  facts: Pick<
    ExecutiveCooFacts,
    "operationsHealthScore" | "revenueOpportunity" | "inventoryRisk" | "growthScore"
  >,
): ExecutiveCooOutput {
  return {
    summary:
      "Operations health is mixed: inventory stabilization should precede growth acceleration while revenue recovery actions remain available.",
    priority: 2,
    confidence: 0.86,
    operationsHealthScore: facts.operationsHealthScore,
    findings: [
      {
        id: "executive-inventory-pressure",
        focusArea: "Inventory",
        title: "Inventory risk is limiting campaign readiness",
        detail: "Specialist agents report low-stock pressure on hero SKUs that support revenue recovery.",
        severity: "high",
        confidence: 0.88,
      },
      {
        id: "executive-retention-gap",
        focusArea: "Growth",
        title: "Retention is limiting expansion momentum",
        detail: "Returning customer rate remains below the threshold needed for scalable acquisition spend.",
        severity: "medium",
        confidence: 0.84,
      },
    ],
    topPriorities: [
      {
        id: "executive-coo:inventory-replenishment",
        focusArea: "Inventory",
        title: "Replenish hero SKUs before campaign push",
        reason:
          "Inventory intelligence flagged low stock on high-velocity products that anchor revenue recovery.",
        supportingAgents: ["inventory_intelligence"],
        sourceRecommendationIds: ["inventory:replenish-hero-skus"],
        evidenceKeys: ["operations_health_score", "inventory_risk", "store_health_score"],
        merchantAction: [
          "Prioritize replenishment purchase orders for hero SKUs",
          "Pause discount campaigns on low-stock products",
        ],
        expectedResult: "Reduce stockout risk on hero products",
        estimatedImpact: "Protect revenue on top-selling SKUs within one replenishment cycle",
        difficulty: "Medium",
        priority: 2,
        confidence: 0.89,
        verificationCriteria: "Hero SKU stock levels recover before the next campaign window",
        timeline: "1-2 weeks",
        executionOrder: 1,
        dependsOn: [],
      },
      {
        id: "executive-coo:retention-winback",
        focusArea: "Growth",
        title: "Launch repeat-buyer win-back sequence",
        reason:
          "Growth intelligence identified retention headroom that can unlock repeat revenue without new traffic.",
        supportingAgents: ["growth_intelligence"],
        sourceRecommendationIds: ["growth:retention-winback"],
        evidenceKeys: ["growth_score", "operations_health_score", "revenue_opportunity"],
        merchantAction: [
          "Email repeat buyers with replenishment reminders",
          "Offer bundle incentive for second purchase within 30 days",
        ],
        expectedResult: "Improve repeat purchase rate without eroding margin",
        estimatedImpact: "Lift repeat revenue within 30 days",
        difficulty: "Easy",
        priority: 2,
        confidence: 0.87,
        verificationCriteria: "Repeat purchase rate improves after win-back campaign",
        timeline: "2 weeks",
        executionOrder: 2,
        dependsOn: ["executive-coo:inventory-replenishment"],
      },
      {
        id: "executive-coo:margin-recovery",
        focusArea: "Revenue",
        title: "Reduce discount depth on premium SKUs",
        reason:
          "Pricing intelligence identified margin recovery room on premium products without sacrificing velocity.",
        supportingAgents: ["pricing_intelligence"],
        sourceRecommendationIds: ["pricing:margin-recovery"],
        evidenceKeys: ["revenue_opportunity", "operations_health_score", "store_health_score"],
        merchantAction: [
          "Reduce automatic discount depth on premium SKUs",
          "Test value messaging before additional markdowns",
        ],
        expectedResult: "Recover margin on premium products",
        estimatedImpact: "Improve gross profit on high-margin SKUs within one pricing cycle",
        difficulty: "Medium",
        priority: 3,
        confidence: 0.83,
        verificationCriteria: "Average margin improves after discount depth adjustment",
        timeline: "2 weeks",
        executionOrder: 3,
        dependsOn: [],
      },
    ],
    risks: ["Inventory pressure may delay growth campaigns"],
    opportunities: ["Revenue recovery and retention actions can compound after inventory stabilization"],
    operationalPlan:
      "Stabilize inventory on hero SKUs, launch the retention win-back sequence, then review premium SKU discount depth for margin recovery.",
    executionSequence: [
      "executive-coo:inventory-replenishment",
      "executive-coo:retention-winback",
      "executive-coo:margin-recovery",
    ],
  };
}

