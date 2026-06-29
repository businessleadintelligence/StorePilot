import { z } from "zod";

export const GROWTH_INTELLIGENCE_CATEGORIES = [
  "Revenue Growth",
  "AOV Growth",
  "Upsell",
  "Cross-sell",
  "Retention",
  "Repeat Purchases",
  "Collections",
  "Campaigns",
  "Merchandising",
  "Seasonal Growth",
  "Landing Pages",
  "Customer Lifetime Value",
] as const;

export const GROWTH_INTELLIGENCE_GROUPS = [
  "Immediate Revenue Wins",
  "AOV Growth",
  "Retention",
  "Repeat Purchases",
  "Collections",
  "Campaigns",
  "Merchandising",
  "Seasonal Growth",
  "Long-Term Growth",
  "Strategic Opportunities",
] as const;

export const GROWTH_INTELLIGENCE_DIFFICULTIES = ["Easy", "Medium", "Hard"] as const;

export type GrowthIntelligenceCategory = (typeof GROWTH_INTELLIGENCE_CATEGORIES)[number];
export type GrowthIntelligenceGroup = (typeof GROWTH_INTELLIGENCE_GROUPS)[number];

export const growthEstimatedImpactSchema = z.object({
  revenueIncrease: z.number().nullable().optional(),
  profitIncrease: z.number().nullable().optional(),
  aovLift: z.number().nullable().optional(),
  retentionLift: z.number().nullable().optional(),
});

export const growthVerificationSchema = z.object({
  expectedMetric: z.string().min(1),
  expectedDirection: z.enum(["Increase", "Decrease", "Stable"]),
  expectedWindow: z.string().min(1),
});

export const growthRecommendationTimelineSchema = z.object({
  detected: z.string().min(1),
  created: z.string().min(1),
  viewed: z.string().nullable().optional(),
  implemented: z.string().nullable().optional(),
  verifying: z.string().nullable().optional(),
  verified: z.string().nullable().optional(),
  closed: z.string().nullable().optional(),
});

export const growthScoreExplanationSchema = z.object({
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

export const growthRecommendationGroupsSchema = z.object({
  immediateRevenueWins: z.array(z.string().min(1)),
  aovGrowth: z.array(z.string().min(1)),
  retention: z.array(z.string().min(1)),
  repeatPurchases: z.array(z.string().min(1)),
  collections: z.array(z.string().min(1)),
  campaigns: z.array(z.string().min(1)),
  merchandising: z.array(z.string().min(1)),
  seasonalGrowth: z.array(z.string().min(1)),
  longTermGrowth: z.array(z.string().min(1)),
  strategicOpportunities: z.array(z.string().min(1)),
});

export const growthFindingSchema = z.object({
  id: z.string().min(1),
  category: z.enum(GROWTH_INTELLIGENCE_CATEGORIES),
  title: z.string().min(1),
  detail: z.string().min(1),
  severity: z.enum(["low", "medium", "high", "critical"]),
  confidence: z.number().min(0).max(1),
});

export const growthIntelligenceRecommendationDraftSchema = z.object({
  id: z.string().min(1),
  category: z.enum(GROWTH_INTELLIGENCE_CATEGORIES),
  title: z.string().min(5),
  reason: z.string().min(10),
  evidenceKeys: z.array(z.string().min(1)).min(1),
  merchantAction: z.array(z.string().min(1)).min(1),
  expectedResult: z.string().min(5),
  estimatedImpact: z.string().min(5),
  difficulty: z.enum(GROWTH_INTELLIGENCE_DIFFICULTIES),
  priority: z.number().int().min(1).max(5),
  confidence: z.number().min(0).max(1),
  verificationCriteria: z.string().min(5),
  timeline: z.string().min(1),
});

export const growthIntelligenceRecommendationSchema = growthIntelligenceRecommendationDraftSchema.extend({
  priorityScore: z.number().min(0).max(100),
  estimatedImpactMetrics: growthEstimatedImpactSchema,
  evidence: z.array(z.string().min(1)).min(1),
  verification: growthVerificationSchema,
  group: z.enum(GROWTH_INTELLIGENCE_GROUPS),
  recommendationTimeline: growthRecommendationTimelineSchema,
  tasks: z.array(z.string().min(1)).min(1),
  estimatedRevenueGain: z.number().min(0),
  estimatedProfitGain: z.number().min(0),
  estimatedAovLift: z.number().min(0),
  estimatedRetentionLift: z.number().min(0),
  estimatedImplementationTime: z.string().min(1),
});

export const growthIntelligenceSchema = z.object({
  summary: z.string().min(1).max(500),
  priority: z.number().int().min(1).max(5),
  confidence: z.number().min(0).max(1),
  growthHealthScore: z.number().int().min(0).max(100),
  growthScore: z.number().int().min(0).max(100),
  findings: z.array(growthFindingSchema),
  recommendations: z.array(growthIntelligenceRecommendationDraftSchema).min(1),
  risks: z.array(z.string().min(1)),
  opportunities: z.array(z.string().min(1)),
  growthStrategy: z.string().min(10),
  expectedRevenueLift: z.number().min(0),
  expectedProfitLift: z.number().min(0),
  campaignSuggestions: z.array(z.string().min(1)).min(1),
  growthInsights: z.array(z.string().min(1)).optional(),
  retentionInsights: z.array(z.string().min(1)).optional(),
  healthExplanation: growthScoreExplanationSchema.optional(),
  recommendationGroups: growthRecommendationGroupsSchema.optional(),
});

export const growthIntelligenceEnrichedSchema = growthIntelligenceSchema.extend({
  healthExplanation: growthScoreExplanationSchema,
  recommendationGroups: growthRecommendationGroupsSchema,
  recommendations: z.array(growthIntelligenceRecommendationSchema).min(1),
  criticalGrowthRisks: z.array(z.string().min(1)),
  quickGrowthWins: z.array(z.string().min(1)),
  expansionOpportunities: z.array(z.string().min(1)),
  revenueOpportunity: z.number().min(0),
  aovOpportunity: z.number().min(0),
  campaignTimeline: z.array(
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

export type GrowthEstimatedImpact = z.infer<typeof growthEstimatedImpactSchema>;
export type GrowthIntelligenceOutput = z.infer<typeof growthIntelligenceSchema>;
export type GrowthIntelligenceEnrichedOutput = z.infer<typeof growthIntelligenceEnrichedSchema>;
export type GrowthIntelligenceRecommendationDraft = z.infer<typeof growthIntelligenceRecommendationDraftSchema>;
export type GrowthIntelligenceRecommendation = z.infer<typeof growthIntelligenceRecommendationSchema>;
export type GrowthHealthExplanation = z.infer<typeof growthScoreExplanationSchema>;

export function buildGrowthIntelligenceDeliverableFields(input: {
  facts: Pick<GrowthIntelligenceFactsLike, "growthScore" | "revenueOpportunity" | "aovOpportunity">;
  recommendations: Array<{ id: string; title: string; group: string; priority: number }>;
  findings: Array<{ title: string; severity: string }>;
}): Pick<
  GrowthIntelligenceEnrichedOutput,
  | "criticalGrowthRisks"
  | "quickGrowthWins"
  | "expansionOpportunities"
  | "revenueOpportunity"
  | "aovOpportunity"
  | "campaignTimeline"
> {
  const quickGrowthWins = input.recommendations
    .filter((item) => item.group === "Immediate Revenue Wins")
    .map((item) => item.title);
  const criticalGrowthRisks = input.findings
    .filter((item) => item.severity === "critical" || item.severity === "high")
    .map((item) => item.title);
  const expansionOpportunities = input.recommendations
    .filter((item) => item.group === "Strategic Opportunities")
    .map((item) => item.title);

  return {
    criticalGrowthRisks,
    quickGrowthWins,
    expansionOpportunities,
    revenueOpportunity: input.facts.revenueOpportunity,
    aovOpportunity: input.facts.aovOpportunity,
    campaignTimeline: [
      { label: "Growth Score", value: input.facts.growthScore },
      { label: "Revenue Opportunity", value: input.facts.revenueOpportunity },
      { label: "AOV Opportunity", value: input.facts.aovOpportunity },
    ],
  };
}

type GrowthIntelligenceFactsLike = {
  growthScore: number;
  revenueOpportunity: number;
  aovOpportunity: number;
};
