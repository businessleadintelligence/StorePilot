import { z } from "zod";

export const TREND_INTELLIGENCE_CATEGORIES = [
  "Emerging Opportunity",
  "Seasonal Trend",
  "Declining Demand",
  "Product Momentum",
  "Category Momentum",
  "Inventory Alignment",
  "Revenue Recovery",
  "Merchandising",
] as const;

export const TREND_INTELLIGENCE_GROUPS = [
  "Emerging Opportunities",
  "Seasonal Plays",
  "Decline Mitigation",
  "Category Growth",
  "Long-Term Trend Strategy",
] as const;

export const TREND_INTELLIGENCE_DIFFICULTIES = ["Easy", "Medium", "Hard"] as const;

export type TrendIntelligenceCategory = (typeof TREND_INTELLIGENCE_CATEGORIES)[number];
export type TrendIntelligenceGroup = (typeof TREND_INTELLIGENCE_GROUPS)[number];

export const trendEstimatedImpactSchema = z.object({
  revenueOpportunity: z.number().nullable().optional(),
  unitsProtected: z.number().nullable().optional(),
  demandLift: z.number().nullable().optional(),
  inventoryAlignment: z.number().nullable().optional(),
});

export type TrendEstimatedImpact = z.infer<typeof trendEstimatedImpactSchema>;

export const trendVerificationSchema = z.object({
  expectedMetric: z.string().min(1),
  expectedDirection: z.enum(["Increase", "Decrease", "Stable"]),
  expectedWindow: z.string().min(1),
});

export const trendRecommendationTimelineSchema = z.object({
  detected: z.string().min(1),
  created: z.string().min(1),
  viewed: z.string().nullable().optional(),
  implemented: z.string().nullable().optional(),
  verifying: z.string().nullable().optional(),
  verified: z.string().nullable().optional(),
  closed: z.string().nullable().optional(),
});

export const trendHealthExplanationSchema = z.object({
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

export const trendRecommendationGroupsSchema = z.object({
  emergingOpportunities: z.array(z.string().min(1)),
  seasonalPlays: z.array(z.string().min(1)),
  declineMitigation: z.array(z.string().min(1)),
  categoryGrowth: z.array(z.string().min(1)),
  longTermTrendStrategy: z.array(z.string().min(1)),
});

export const trendFindingSchema = z.object({
  id: z.string().min(1),
  category: z.enum(TREND_INTELLIGENCE_CATEGORIES),
  title: z.string().min(1),
  detail: z.string().min(1),
  severity: z.enum(["low", "medium", "high", "critical"]),
  confidence: z.number().min(0).max(1),
});

export const trendProductSignalSchema = z.object({
  productId: z.string().min(1),
  title: z.string().min(1),
  direction: z.enum(["emerging", "stable", "declining", "unknown"]),
  growthRate: z.number(),
  momentum: z.number(),
  sales30Days: z.number().min(0),
});

export const trendSeasonalSignalSchema = z.object({
  label: z.string().min(1),
  strength: z.number().min(0),
  month: z.number().int().min(1).max(12).nullable().optional(),
});

export const trendIntelligenceRecommendationDraftSchema = z.object({
  id: z.string().min(1),
  category: z.enum(TREND_INTELLIGENCE_CATEGORIES),
  title: z.string().min(5),
  reason: z.string().min(10),
  evidenceKeys: z.array(z.string().min(1)).min(1),
  merchantAction: z.array(z.string().min(1)).min(1),
  expectedResult: z.string().min(5),
  estimatedImpact: z.string().min(5),
  difficulty: z.enum(TREND_INTELLIGENCE_DIFFICULTIES),
  priority: z.number().int().min(1).max(5),
  confidence: z.number().min(0).max(1),
  verificationCriteria: z.string().min(5),
  timeline: z.string().min(1),
  productId: z.string().nullable().optional(),
});

export const trendIntelligenceRecommendationSchema = trendIntelligenceRecommendationDraftSchema.extend({
  priorityScore: z.number().min(0).max(100),
  estimatedImpactMetrics: trendEstimatedImpactSchema,
  evidence: z.array(z.string().min(1)).min(1),
  verification: trendVerificationSchema,
  group: z.enum(TREND_INTELLIGENCE_GROUPS),
  recommendationTimeline: trendRecommendationTimelineSchema,
  tasks: z.array(z.string().min(1)).min(1),
});

export const trendIntelligenceSchema = z.object({
  summary: z.string().min(1).max(500),
  priority: z.number().int().min(1).max(5),
  confidence: z.number().min(0).max(1),
  trendHealthScore: z.number().int().min(0).max(100),
  trendDirection: z.enum(["emerging", "stable", "declining", "mixed", "unknown"]),
  healthExplanation: trendHealthExplanationSchema.optional(),
  findings: z.array(trendFindingSchema),
  recommendations: z.array(trendIntelligenceRecommendationDraftSchema).min(1),
  risks: z.array(z.string().min(1)),
  opportunities: z.array(z.string().min(1)),
  emergingProducts: z.array(trendProductSignalSchema),
  decliningProducts: z.array(trendProductSignalSchema),
  seasonalSignals: z.array(trendSeasonalSignalSchema),
  recommendationGroups: trendRecommendationGroupsSchema.optional(),
});

export const trendIntelligenceEnrichedSchema = trendIntelligenceSchema.extend({
  healthExplanation: trendHealthExplanationSchema,
  recommendationGroups: trendRecommendationGroupsSchema,
  recommendations: z.array(trendIntelligenceRecommendationSchema).min(1),
});

export type TrendIntelligenceOutput = z.infer<typeof trendIntelligenceSchema>;
export type TrendIntelligenceEnrichedOutput = z.infer<typeof trendIntelligenceEnrichedSchema>;
export type TrendIntelligenceRecommendationDraft = z.infer<
  typeof trendIntelligenceRecommendationDraftSchema
>;
export type TrendIntelligenceRecommendation = z.infer<typeof trendIntelligenceRecommendationSchema>;
export type TrendHealthExplanation = z.infer<typeof trendHealthExplanationSchema>;
