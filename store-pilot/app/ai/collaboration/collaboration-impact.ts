import type {
  CollaborationImpactMetrics,
  CollaborationRecommendationInput,
} from "./collaboration-types";

export function aggregateCollaborationImpact(
  recommendations: CollaborationRecommendationInput[],
): CollaborationImpactMetrics {
  return recommendations.reduce(
    (total, recommendation) => ({
      revenueOpportunity: total.revenueOpportunity + recommendation.estimatedImpact.revenueOpportunity,
      revenueRecovered: total.revenueRecovered + recommendation.estimatedImpact.revenueRecovered,
      inventoryReduction: total.inventoryReduction + recommendation.estimatedImpact.inventoryReduction,
      conversionLift: total.conversionLift + recommendation.estimatedImpact.conversionLift,
      ordersProtected: total.ordersProtected + recommendation.estimatedImpact.ordersProtected,
    }),
    {
      revenueOpportunity: 0,
      revenueRecovered: 0,
      inventoryReduction: 0,
      conversionLift: 0,
      ordersProtected: 0,
    },
  );
}

export function calculateExecutiveActionImpact(impact: CollaborationImpactMetrics) {
  return {
    revenueImpact: Number((impact.revenueOpportunity + impact.revenueRecovered).toFixed(2)),
    inventoryImpact: Number(impact.inventoryReduction.toFixed(2)),
    conversionImpact: Number(impact.conversionLift.toFixed(2)),
  };
}

export function calculateCollaborationExpectedImpact(
  actions: Array<{
    estimatedRevenueImpact: number;
    estimatedInventoryImpact: number;
    estimatedConversionImpact: number;
  }>,
) {
  return {
    revenueLift: Number(
      actions.reduce((total, action) => total + action.estimatedRevenueImpact, 0).toFixed(2),
    ),
    inventoryReduction: Number(
      actions.reduce((total, action) => total + action.estimatedInventoryImpact, 0).toFixed(2),
    ),
    conversionImprovement: Number(
      actions.reduce((total, action) => total + action.estimatedConversionImpact, 0).toFixed(2),
    ),
  };
}
