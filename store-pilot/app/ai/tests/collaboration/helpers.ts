import type { CollaborationRecommendationInput } from "../../collaboration/collaboration-types";
import { buildCollaborationContextFromInputs, buildCollaborationMemoryFromRecords } from "../../collaboration/collaboration-context";

function baseRecommendation(
  overrides: Partial<CollaborationRecommendationInput> & Pick<CollaborationRecommendationInput, "recommendationId" | "agentId" | "title">,
): CollaborationRecommendationInput {
  return {
    stableId: `stable-${overrides.recommendationId}`,
    subjectKey: overrides.productId ? `product:${overrides.productId}` : "inventory:store-1",
    productId: overrides.productId ?? "product-1",
    productTitle: overrides.productTitle ?? "Protein Powder",
    reason: overrides.reason ?? "Strong demand signal requires action",
    category: overrides.category ?? "Inventory",
    group: overrides.group ?? "Critical Risks",
    priority: overrides.priority ?? 2,
    priorityScore: overrides.priorityScore ?? 80,
    confidence: overrides.confidence ?? 0.9,
    difficulty: overrides.difficulty ?? "Medium",
    status: overrides.status ?? "open",
    evidence: overrides.evidence ?? ["30 day sales +38%"],
    evidenceKeys: overrides.evidenceKeys ?? ["sales_velocity"],
    merchantAction: overrides.merchantAction ?? ["Increase Protein Powder purchase order quantity"],
    expectedResult: overrides.expectedResult ?? "Protect revenue during sustained demand",
    estimatedImpact: overrides.estimatedImpact ?? {
      revenueOpportunity: 42000,
      revenueRecovered: 0,
      inventoryReduction: 0,
      conversionLift: 0,
      ordersProtected: 300,
    },
    verificationCriteria: overrides.verificationCriteria ?? "Inventory coverage improves within 14 days",
    timeline: overrides.timeline ?? "1-2 weeks",
    ...overrides,
  };
}

export function createMockRecommendations(input?: {
  reinforced?: boolean;
  withConflict?: boolean;
  withDependency?: boolean;
}): CollaborationRecommendationInput[] {
  const recommendations: CollaborationRecommendationInput[] = [
    baseRecommendation({
      recommendationId: "inventory:restock-protein",
      agentId: "inventory_intelligence",
      title: "Increase inventory for Protein Powder",
      category: "Inventory",
      merchantAction: ["Increase Protein Powder purchase order quantity"],
    }),
    baseRecommendation({
      recommendationId: "trend:promote-protein",
      agentId: "trend_intelligence",
      title: "Promote Protein Powder while demand is emerging",
      category: "Emerging Opportunity",
      reason: "Protein Powder demand is accelerating against the 30-day baseline",
      merchantAction: ["Feature Protein Powder on homepage"],
    }),
    baseRecommendation({
      recommendationId: "product:optimize-protein",
      agentId: "product_intelligence",
      title: "Optimize Protein Powder merchandising",
      category: "Revenue",
      merchantAction: ["Refresh Protein Powder product page messaging"],
    }),
  ];

  if (input?.reinforced) {
    recommendations.push(
      baseRecommendation({
        recommendationId: "bundle:protein-starter",
        agentId: "bundle_discovery",
        title: "Launch Protein Starter Bundle with Shaker Bottle",
        category: "Revenue",
        reason: "Bundle pair shows strong attach potential",
        merchantAction: ["Create Protein Starter Bundle offer"],
      }),
    );
  }

  if (input?.withDependency) {
    recommendations.push(
      baseRecommendation({
        recommendationId: "bundle:fitness-starter",
        agentId: "bundle_discovery",
        title: "Launch Fitness Starter Bundle",
        category: "Revenue",
        reason: "Bundle recommendation depends on shaker inventory and campaign readiness",
        merchantAction: ["Launch Fitness Starter Bundle on homepage"],
      }),
    );
  }

  if (input?.withConflict) {
    recommendations.push(
      baseRecommendation({
        recommendationId: "inventory:liquidate-protein",
        agentId: "inventory_intelligence",
        title: "Liquidate excess Protein Powder inventory",
        category: "Declining Demand",
        reason: "Protein Powder demand is collapsing and inventory is at risk",
        merchantAction: ["Run Protein Powder clearance discount"],
      }),
      baseRecommendation({
        recommendationId: "trend:restock-protein-conflict",
        agentId: "trend_intelligence",
        title: "Restock Protein Powder immediately",
        category: "Emerging Opportunity",
        reason: "Protein Powder emerging demand requires replenishment",
        merchantAction: ["Increase Protein Powder purchase order quantity immediately"],
      }),
    );
  }

  return recommendations;
}

export function createMockCollaborationContext(recommendations: CollaborationRecommendationInput[]) {
  return buildCollaborationContextFromInputs({
    storeId: "store-1",
    recommendations,
    agentResults: [
      {
        agentId: "product_intelligence",
        subjectKey: "product:product-1",
        summary: "Product health stable",
        healthScore: 82,
        confidence: 0.9,
        resultJson: { healthScore: 82 },
        createdAt: "2026-06-20T08:00:00.000Z",
      },
      {
        agentId: "inventory_intelligence",
        subjectKey: "inventory:store-1",
        summary: "Inventory risk detected",
        healthScore: 74,
        confidence: 0.88,
        resultJson: { inventoryHealthScore: 74 },
        createdAt: "2026-06-20T08:00:00.000Z",
      },
      {
        agentId: "trend_intelligence",
        subjectKey: "trend:store-1",
        summary: "Mixed trend picture",
        healthScore: 72,
        confidence: 0.86,
        resultJson: { trendHealthScore: 72 },
        createdAt: "2026-06-20T08:00:00.000Z",
      },
    ],
    memory: buildCollaborationMemoryFromRecords([]),
    storeMetrics: {
      storeHealth: 80,
      revenueHealth: 78,
      inventoryHealth: 74,
      growthScore: 68,
    },
  });
}
