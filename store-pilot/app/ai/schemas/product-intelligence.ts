import { z } from "zod";

export const PRODUCT_INTELLIGENCE_CATEGORIES = [
  "Inventory",
  "Revenue",
  "Pricing",
  "Marketing",
  "SEO",
  "Conversion",
  "Promotion",
  "Merchandising",
] as const;

export const PRODUCT_INTELLIGENCE_GROUPS = [
  "Critical Risks",
  "Revenue Opportunities",
  "Quick Wins",
  "Operational Improvements",
  "Long-Term Strategy",
] as const;

export const PRODUCT_INTELLIGENCE_DIFFICULTIES = ["Easy", "Medium", "Hard"] as const;

export type ProductIntelligenceCategory = (typeof PRODUCT_INTELLIGENCE_CATEGORIES)[number];
export type ProductIntelligenceGroup = (typeof PRODUCT_INTELLIGENCE_GROUPS)[number];

export const estimatedImpactSchema = z.object({
  revenueRecovered: z.number().nullable().optional(),
  revenueOpportunity: z.number().nullable().optional(),
  ordersProtected: z.number().nullable().optional(),
  inventoryDaysSaved: z.number().nullable().optional(),
  inventoryCostSaved: z.number().nullable().optional(),
  estimatedLostSales: z.number().nullable().optional(),
  marginImprovement: z.number().nullable().optional(),
});

export const verificationSchema = z.object({
  expectedMetric: z.string().min(1),
  expectedDirection: z.enum(["Increase", "Decrease", "Stable"]),
  expectedWindow: z.string().min(1),
});

export const recommendationTimelineSchema = z.object({
  detected: z.string().min(1),
  created: z.string().min(1),
  viewed: z.string().nullable().optional(),
  implemented: z.string().nullable().optional(),
  verifying: z.string().nullable().optional(),
  verified: z.string().nullable().optional(),
  closed: z.string().nullable().optional(),
});

export const productIntelligenceRecommendationDraftSchema = z.object({
  id: z.string().min(1),
  category: z.enum(PRODUCT_INTELLIGENCE_CATEGORIES),
  title: z.string().min(5),
  reason: z.string().min(10),
  evidenceKeys: z.array(z.string().min(1)).min(1),
  merchantAction: z.array(z.string().min(1)).min(1),
  difficulty: z.enum(PRODUCT_INTELLIGENCE_DIFFICULTIES),
  confidence: z.number().min(0).max(1),
  expectedResult: z.string().min(5),
  potentialRisk: z.string().min(5),
  estimatedTime: z.string().min(1),
  businessImpact: z.string().min(5),
});

export const productIntelligenceRecommendationSchema = productIntelligenceRecommendationDraftSchema.extend({
  priority: z.number().int().min(1).max(5),
  priorityScore: z.number().min(0).max(100),
  estimatedImpact: estimatedImpactSchema,
  evidence: z.array(z.string().min(1)).min(1),
  verification: verificationSchema,
  group: z.enum(PRODUCT_INTELLIGENCE_GROUPS),
  timeline: recommendationTimelineSchema,
  tasks: z.array(z.string().min(1)).min(1),
  expectedImpact: z.string().min(5).optional(),
  estimatedDifficulty: z.enum(["Low", "Medium", "High"]).optional(),
});

export const healthExplanationSchema = z.object({
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

export const recommendationGroupsSchema = z.object({
  criticalRisks: z.array(z.string().min(1)),
  revenueOpportunities: z.array(z.string().min(1)),
  quickWins: z.array(z.string().min(1)),
  operationalImprovements: z.array(z.string().min(1)),
  longTermStrategy: z.array(z.string().min(1)),
});

export const productIntelligenceFindingSchema = z.object({
  id: z.string().min(1),
  category: z.enum(PRODUCT_INTELLIGENCE_CATEGORIES),
  title: z.string().min(1),
  detail: z.string().min(1),
  severity: z.enum(["low", "medium", "high", "critical"]),
  confidence: z.number().min(0).max(1),
});

export const productIntelligenceSchema = z.object({
  summary: z.string().min(1).max(500),
  priority: z.number().int().min(1).max(5),
  confidence: z.number().min(0).max(1),
  healthScore: z.number().int().min(0).max(100),
  healthExplanation: healthExplanationSchema.optional(),
  findings: z.array(productIntelligenceFindingSchema),
  recommendations: z.array(productIntelligenceRecommendationDraftSchema).min(1),
  recommendationGroups: recommendationGroupsSchema.optional(),
  opportunities: z.array(z.string().min(1)),
  risks: z.array(z.string().min(1)),
});

export const productIntelligenceEnrichedSchema = productIntelligenceSchema.extend({
  healthExplanation: healthExplanationSchema,
  recommendationGroups: recommendationGroupsSchema,
  recommendations: z.array(productIntelligenceRecommendationSchema).min(1),
});

export type ProductIntelligenceOutput = z.infer<typeof productIntelligenceSchema>;
export type ProductIntelligenceEnrichedOutput = z.infer<typeof productIntelligenceEnrichedSchema>;
export type ProductIntelligenceRecommendationDraft = z.infer<
  typeof productIntelligenceRecommendationDraftSchema
>;
export type ProductIntelligenceRecommendation = z.infer<
  typeof productIntelligenceRecommendationSchema
>;
export type EstimatedImpact = z.infer<typeof estimatedImpactSchema>;
export type HealthExplanation = z.infer<typeof healthExplanationSchema>;
