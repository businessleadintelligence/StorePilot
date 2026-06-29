import { z } from "zod";

export const INVENTORY_INTELLIGENCE_CATEGORIES = [
  "Stockout",
  "Overstock",
  "Dead Inventory",
  "Reorder",
  "Supplier",
  "Warehouse",
  "Bundle Opportunity",
  "Clearance",
  "Operational",
] as const;

export const INVENTORY_INTELLIGENCE_GROUPS = [
  "Critical Inventory Risks",
  "Immediate Reorders",
  "Cash Flow Opportunities",
  "Warehouse Optimizations",
  "Long-Term Planning",
] as const;

export const INVENTORY_INTELLIGENCE_DIFFICULTIES = ["Easy", "Medium", "Hard"] as const;

export type InventoryIntelligenceCategory = (typeof INVENTORY_INTELLIGENCE_CATEGORIES)[number];
export type InventoryIntelligenceGroup = (typeof INVENTORY_INTELLIGENCE_GROUPS)[number];

export const inventoryEstimatedImpactSchema = z.object({
  ordersProtected: z.number().nullable().optional(),
  inventoryDaysSaved: z.number().nullable().optional(),
  inventoryCostSaved: z.number().nullable().optional(),
  unitsRecovered: z.number().nullable().optional(),
});

export const inventoryVerificationSchema = z.object({
  expectedMetric: z.string().min(1),
  expectedDirection: z.enum(["Increase", "Decrease", "Stable"]),
  expectedWindow: z.string().min(1),
});

export const inventoryRecommendationTimelineSchema = z.object({
  detected: z.string().min(1),
  created: z.string().min(1),
  viewed: z.string().nullable().optional(),
  implemented: z.string().nullable().optional(),
  verifying: z.string().nullable().optional(),
  verified: z.string().nullable().optional(),
  closed: z.string().nullable().optional(),
});

export const inventoryHealthExplanationSchema = z.object({
  score: z.number().int().min(0).max(100),
  summary: z.string().min(1),
  drivers: z.array(
    z.object({
      factor: z.string().min(1),
      direction: z.enum(["positive", "negative", "neutral"]),
      detail: z.string().min(1),
    }),
  ),
});

export const inventoryRecommendationGroupsSchema = z.object({
  criticalInventoryRisks: z.array(z.string().min(1)),
  immediateReorders: z.array(z.string().min(1)),
  cashFlowOpportunities: z.array(z.string().min(1)),
  warehouseOptimizations: z.array(z.string().min(1)),
  longTermPlanning: z.array(z.string().min(1)),
});

export const inventoryIntelligenceRecommendationDraftSchema = z.object({
  id: z.string().min(1),
  category: z.enum(INVENTORY_INTELLIGENCE_CATEGORIES),
  title: z.string().min(5),
  reason: z.string().min(10),
  evidenceKeys: z.array(z.string().min(1)).min(1),
  merchantAction: z.array(z.string().min(1)).min(1),
  estimatedDifficulty: z.enum(INVENTORY_INTELLIGENCE_DIFFICULTIES),
  confidence: z.number().min(0).max(1),
  expectedResult: z.string().min(5),
  potentialRisk: z.string().min(5),
  estimatedTime: z.string().min(1),
  businessImpact: z.string().min(5),
});

export const inventoryIntelligenceRecommendationSchema =
  inventoryIntelligenceRecommendationDraftSchema.extend({
    priority: z.number().int().min(1).max(5),
    priorityScore: z.number().min(0).max(100),
    estimatedImpact: inventoryEstimatedImpactSchema,
    evidence: z.array(z.string().min(1)).min(1),
    verification: inventoryVerificationSchema,
    group: z.enum(INVENTORY_INTELLIGENCE_GROUPS),
    timeline: inventoryRecommendationTimelineSchema,
    tasks: z.array(z.string().min(1)).min(1),
    expectedImpact: z.string().min(5).optional(),
  });

export const inventoryFindingSchema = z.object({
  id: z.string().min(1),
  category: z.enum(INVENTORY_INTELLIGENCE_CATEGORIES),
  title: z.string().min(1),
  detail: z.string().min(1),
  severity: z.enum(["low", "medium", "high", "critical"]),
  confidence: z.number().min(0).max(1),
});

export const inventoryAlertSchema = z.object({
  id: z.string().min(1),
  productId: z.string().min(1),
  title: z.string().min(1),
  severity: z.enum(["low", "medium", "high", "critical"]),
  detail: z.string().min(1),
});

export const inventoryProductSummarySchema = z.object({
  productId: z.string().min(1),
  title: z.string().min(1),
  detail: z.string().min(1),
});

export const inventoryIntelligenceSchema = z.object({
  summary: z.string().min(1).max(500),
  priority: z.number().int().min(1).max(5),
  confidence: z.number().min(0).max(1),
  inventoryHealthScore: z.number().int().min(0).max(100),
  healthExplanation: inventoryHealthExplanationSchema.optional(),
  findings: z.array(inventoryFindingSchema),
  recommendations: z.array(inventoryIntelligenceRecommendationDraftSchema).min(1),
  stockAlerts: z.array(inventoryAlertSchema),
  reorderSuggestions: z.array(
    z.object({
      productId: z.string().min(1),
      title: z.string().min(1),
      suggestedQuantity: z.number().int().min(1),
      urgency: z.number().int().min(1).max(5),
    }),
  ),
  overstockProducts: z.array(inventoryProductSummarySchema),
  understockProducts: z.array(inventoryProductSummarySchema),
  deadInventory: z.array(inventoryProductSummarySchema),
  opportunities: z.array(z.string().min(1)),
  risks: z.array(z.string().min(1)),
  recommendationGroups: inventoryRecommendationGroupsSchema.optional(),
});

export const inventoryIntelligenceEnrichedSchema = inventoryIntelligenceSchema.extend({
  healthExplanation: inventoryHealthExplanationSchema,
  recommendationGroups: inventoryRecommendationGroupsSchema,
  recommendations: z.array(inventoryIntelligenceRecommendationSchema).min(1),
  deadStockCount: z.number().optional(),
  stockoutAlertCount: z.number().optional(),
  overstockCount: z.number().optional(),
  understockCount: z.number().optional(),
  averageDaysRemaining: z.number().nullable().optional(),
  averageWeeksOfCover: z.number().nullable().optional(),
  averageSellThroughRate: z.number().optional(),
  capitalLockedInInventory: z.number().optional(),
  fastMoverCount: z.number().optional(),
  slowMoverCount: z.number().optional(),
});

export type InventoryEstimatedImpact = z.infer<typeof inventoryEstimatedImpactSchema>;
export type InventoryIntelligenceOutput = z.infer<typeof inventoryIntelligenceSchema>;
export type InventoryIntelligenceEnrichedOutput = z.infer<typeof inventoryIntelligenceEnrichedSchema>;
export type InventoryIntelligenceRecommendationDraft = z.infer<
  typeof inventoryIntelligenceRecommendationDraftSchema
>;
export type InventoryIntelligenceRecommendation = z.infer<
  typeof inventoryIntelligenceRecommendationSchema
>;
export type InventoryHealthExplanation = z.infer<typeof inventoryHealthExplanationSchema>;
