import { z } from "zod";

export const PRICING_INTELLIGENCE_CATEGORIES = [
  "Margin Protection",
  "Discount Optimization",
  "Premium Pricing",
  "Inventory Pricing",
  "Bundle Pricing",
  "Psychological Pricing",
  "Price Consistency",
  "Revenue Optimization",
  "Conversion Pricing",
  "Markdown Timing",
  "Competitive Pricing",
  "Loss Leader Strategy",
] as const;

export const PRICING_INTELLIGENCE_GROUPS = [
  "Critical Pricing Risks",
  "Margin Protection",
  "Quick Revenue Wins",
  "Premium Pricing",
  "Discount Optimization",
  "Inventory Pricing",
  "Bundle Pricing",
  "Long-Term Pricing Strategy",
] as const;

export const PRICING_INTELLIGENCE_DIFFICULTIES = ["Easy", "Medium", "Hard"] as const;

export type PricingIntelligenceCategory = (typeof PRICING_INTELLIGENCE_CATEGORIES)[number];
export type PricingIntelligenceGroup = (typeof PRICING_INTELLIGENCE_GROUPS)[number];

export const pricingEstimatedImpactSchema = z.object({
  revenueIncrease: z.number().nullable().optional(),
  profitIncrease: z.number().nullable().optional(),
  marginImprovement: z.number().nullable().optional(),
  roi: z.number().nullable().optional(),
});

export const pricingVerificationSchema = z.object({
  expectedMetric: z.string().min(1),
  expectedDirection: z.enum(["Increase", "Decrease", "Stable"]),
  expectedWindow: z.string().min(1),
});

export const pricingRecommendationTimelineSchema = z.object({
  detected: z.string().min(1),
  created: z.string().min(1),
  viewed: z.string().nullable().optional(),
  implemented: z.string().nullable().optional(),
  verifying: z.string().nullable().optional(),
  verified: z.string().nullable().optional(),
  closed: z.string().nullable().optional(),
});

export const pricingHealthExplanationSchema = z.object({
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

export const pricingRecommendationGroupsSchema = z.object({
  criticalPricingRisks: z.array(z.string().min(1)),
  marginProtection: z.array(z.string().min(1)),
  quickRevenueWins: z.array(z.string().min(1)),
  premiumPricing: z.array(z.string().min(1)),
  discountOptimization: z.array(z.string().min(1)),
  inventoryPricing: z.array(z.string().min(1)),
  bundlePricing: z.array(z.string().min(1)),
  longTermPricingStrategy: z.array(z.string().min(1)),
});

export const pricingFindingSchema = z.object({
  id: z.string().min(1),
  category: z.enum(PRICING_INTELLIGENCE_CATEGORIES),
  title: z.string().min(1),
  detail: z.string().min(1),
  severity: z.enum(["low", "medium", "high", "critical"]),
  confidence: z.number().min(0).max(1),
});

export const pricingIntelligenceRecommendationDraftSchema = z.object({
  id: z.string().min(1),
  category: z.enum(PRICING_INTELLIGENCE_CATEGORIES),
  title: z.string().min(5),
  reason: z.string().min(10),
  evidenceKeys: z.array(z.string().min(1)).min(1),
  merchantAction: z.array(z.string().min(1)).min(1),
  expectedResult: z.string().min(5),
  estimatedImpact: z.string().min(5),
  difficulty: z.enum(PRICING_INTELLIGENCE_DIFFICULTIES),
  priority: z.number().int().min(1).max(5),
  confidence: z.number().min(0).max(1),
  verificationCriteria: z.string().min(5),
  timeline: z.string().min(1),
});

export const pricingIntelligenceRecommendationSchema = pricingIntelligenceRecommendationDraftSchema.extend({
  priorityScore: z.number().min(0).max(100),
  estimatedImpactMetrics: pricingEstimatedImpactSchema,
  evidence: z.array(z.string().min(1)).min(1),
  verification: pricingVerificationSchema,
  group: z.enum(PRICING_INTELLIGENCE_GROUPS),
  recommendationTimeline: pricingRecommendationTimelineSchema,
  tasks: z.array(z.string().min(1)).min(1),
  estimatedRevenueGain: z.number().min(0),
  estimatedProfitGain: z.number().min(0),
  estimatedMarginImprovement: z.number().min(0),
  estimatedRoi: z.number().min(0),
  estimatedImplementationTime: z.string().min(1),
});

export const pricingIntelligenceSchema = z.object({
  summary: z.string().min(1).max(500),
  priority: z.number().int().min(1).max(5),
  confidence: z.number().min(0).max(1),
  pricingHealthScore: z.number().int().min(0).max(100),
  findings: z.array(pricingFindingSchema),
  recommendations: z.array(pricingIntelligenceRecommendationDraftSchema).min(1),
  risks: z.array(z.string().min(1)),
  opportunities: z.array(z.string().min(1)),
  pricingInsights: z.array(z.string().min(1)),
  profitInsights: z.array(z.string().min(1)),
  healthExplanation: pricingHealthExplanationSchema.optional(),
  recommendationGroups: pricingRecommendationGroupsSchema.optional(),
});

export const pricingIntelligenceEnrichedSchema = pricingIntelligenceSchema.extend({
  healthExplanation: pricingHealthExplanationSchema,
  recommendationGroups: pricingRecommendationGroupsSchema,
  recommendations: z.array(pricingIntelligenceRecommendationSchema).min(1),
  criticalPricingRisks: z.array(z.string().min(1)),
  quickRevenueWins: z.array(z.string().min(1)),
  premiumOpportunities: z.array(z.string().min(1)),
  revenueOpportunity: z.number().min(0),
  profitOpportunity: z.number().min(0),
  pricingTimeline: z.array(
    z.object({
      label: z.string().min(1),
      value: z.number(),
    }),
  ),
  strategyInsights: z.array(
    z.object({
      question: z.string().min(1),
      answer: z.string().min(1),
      confidence: z.number().min(0).max(1),
    }),
  ),
});

export type PricingEstimatedImpact = z.infer<typeof pricingEstimatedImpactSchema>;
export type PricingIntelligenceOutput = z.infer<typeof pricingIntelligenceSchema>;
export type PricingIntelligenceEnrichedOutput = z.infer<typeof pricingIntelligenceEnrichedSchema>;
export type PricingIntelligenceRecommendationDraft = z.infer<typeof pricingIntelligenceRecommendationDraftSchema>;
export type PricingIntelligenceRecommendation = z.infer<typeof pricingIntelligenceRecommendationSchema>;
export type PricingHealthExplanation = z.infer<typeof pricingHealthExplanationSchema>;

export function buildPricingIntelligenceDeliverableFields(input: {
  facts: Pick<PricingIntelligenceFactsLike, "pricingHealthScore" | "revenueOpportunity" | "profitOpportunity">;
  recommendations: Array<{ id: string; title: string; group: string; priority: number }>;
  findings: Array<{ title: string; severity: string }>;
}): Pick<
  PricingIntelligenceEnrichedOutput,
  | "criticalPricingRisks"
  | "quickRevenueWins"
  | "premiumOpportunities"
  | "revenueOpportunity"
  | "profitOpportunity"
  | "pricingTimeline"
> {
  const quickRevenueWins = input.recommendations
    .filter((item) => item.group === "Quick Revenue Wins")
    .map((item) => item.title);
  const criticalPricingRisks = input.findings
    .filter((item) => item.severity === "critical" || item.severity === "high")
    .map((item) => item.title);
  const premiumOpportunities = input.recommendations
    .filter((item) => item.group === "Premium Pricing")
    .map((item) => item.title);

  return {
    criticalPricingRisks,
    quickRevenueWins,
    premiumOpportunities,
    revenueOpportunity: input.facts.revenueOpportunity,
    profitOpportunity: input.facts.profitOpportunity,
    pricingTimeline: [
      { label: "Pricing Health", value: input.facts.pricingHealthScore },
      { label: "Revenue Opportunity", value: input.facts.revenueOpportunity },
      { label: "Profit Opportunity", value: input.facts.profitOpportunity },
    ],
  };
}

type PricingIntelligenceFactsLike = {
  pricingHealthScore: number;
  revenueOpportunity: number;
  profitOpportunity: number;
};
