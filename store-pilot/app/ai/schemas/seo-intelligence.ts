import { z } from "zod";

export const SEO_INTELLIGENCE_CATEGORIES = [
  "Technical SEO",
  "Content",
  "Images",
  "Collections",
  "Products",
  "Navigation",
  "Internal Linking",
  "Structured Data",
  "Core Web Vitals",
  "Indexability",
  "Accessibility",
  "Schema",
  "Metadata",
  "Merchant Trust",
  "Conversion SEO",
] as const;

export const SEO_INTELLIGENCE_GROUPS = [
  "Critical Fixes",
  "Quick Wins",
  "Organic Growth",
  "Technical Improvements",
  "Long-Term SEO Strategy",
] as const;

export const SEO_INTELLIGENCE_DIFFICULTIES = ["Easy", "Medium", "Hard"] as const;

export type SeoIntelligenceCategory = (typeof SEO_INTELLIGENCE_CATEGORIES)[number];
export type SeoIntelligenceGroup = (typeof SEO_INTELLIGENCE_GROUPS)[number];

export const seoEstimatedImpactSchema = z.object({
  trafficGain: z.number().nullable().optional(),
  revenueGain: z.number().nullable().optional(),
  visibilityLift: z.number().nullable().optional(),
  ctrLift: z.number().nullable().optional(),
  indexabilityImprovement: z.number().nullable().optional(),
});

export const seoVerificationSchema = z.object({
  expectedMetric: z.string().min(1),
  expectedDirection: z.enum(["Increase", "Decrease", "Stable"]),
  expectedWindow: z.string().min(1),
});

export const seoRecommendationTimelineSchema = z.object({
  detected: z.string().min(1),
  created: z.string().min(1),
  viewed: z.string().nullable().optional(),
  implemented: z.string().nullable().optional(),
  verifying: z.string().nullable().optional(),
  verified: z.string().nullable().optional(),
  closed: z.string().nullable().optional(),
});

export const seoHealthExplanationSchema = z.object({
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

export const seoRecommendationGroupsSchema = z.object({
  criticalFixes: z.array(z.string().min(1)),
  quickWins: z.array(z.string().min(1)),
  organicGrowth: z.array(z.string().min(1)),
  technicalImprovements: z.array(z.string().min(1)),
  longTermSeoStrategy: z.array(z.string().min(1)),
});

export const seoFindingSchema = z.object({
  id: z.string().min(1),
  category: z.enum(SEO_INTELLIGENCE_CATEGORIES),
  title: z.string().min(1),
  detail: z.string().min(1),
  severity: z.enum(["low", "medium", "high", "critical"]),
  confidence: z.number().min(0).max(1),
  sourceRuleId: z.string().min(1),
  sourceRuleVersion: z.string().min(1),
});

export const seoIntelligenceRecommendationDraftSchema = z.object({
  id: z.string().min(1),
  category: z.enum(SEO_INTELLIGENCE_CATEGORIES),
  title: z.string().min(5),
  reason: z.string().min(10),
  evidenceKeys: z.array(z.string().min(1)).min(1),
  merchantAction: z.array(z.string().min(1)).min(1),
  expectedResult: z.string().min(5),
  estimatedImpact: z.string().min(5),
  difficulty: z.enum(SEO_INTELLIGENCE_DIFFICULTIES),
  priority: z.number().int().min(1).max(5),
  confidence: z.number().min(0).max(1),
  verificationCriteria: z.string().min(5),
  timeline: z.string().min(1),
  sourceRuleId: z.string().min(1),
  sourceRuleVersion: z.string().min(1),
});

export const seoIntelligenceRecommendationSchema = seoIntelligenceRecommendationDraftSchema.extend({
  priorityScore: z.number().min(0).max(100),
  estimatedImpactMetrics: seoEstimatedImpactSchema,
  evidence: z.array(z.string().min(1)).min(1),
  verification: seoVerificationSchema,
  group: z.enum(SEO_INTELLIGENCE_GROUPS),
  recommendationTimeline: seoRecommendationTimelineSchema,
  tasks: z.array(z.string().min(1)).min(1),
  estimatedTrafficGain: z.number().min(0),
  estimatedRevenueImpact: z.number().min(0),
  estimatedImplementationTime: z.string().min(1),
});

export const seoIntelligenceSchema = z.object({
  summary: z.string().min(1).max(500),
  priority: z.number().int().min(1).max(5),
  confidence: z.number().min(0).max(1),
  seoHealthScore: z.number().int().min(0).max(100),
  technicalFindings: z.array(seoFindingSchema),
  contentFindings: z.array(seoFindingSchema),
  structuredDataFindings: z.array(seoFindingSchema),
  recommendations: z.array(seoIntelligenceRecommendationDraftSchema).min(1),
  risks: z.array(z.string().min(1)),
  opportunities: z.array(z.string().min(1)),
  healthExplanation: seoHealthExplanationSchema.optional(),
  recommendationGroups: seoRecommendationGroupsSchema.optional(),
});

export const seoIntelligenceEnrichedSchema = seoIntelligenceSchema.extend({
  healthExplanation: seoHealthExplanationSchema,
  recommendationGroups: seoRecommendationGroupsSchema,
  recommendations: z.array(seoIntelligenceRecommendationSchema).min(1),
  criticalIssues: z.array(z.string().min(1)),
  quickWins: z.array(z.string().min(1)),
  longTermOpportunities: z.array(z.string().min(1)),
  trafficOpportunity: z.number().min(0),
  visibilityOpportunity: z.number().min(0),
  seoTimeline: z.array(
    z.object({
      label: z.string().min(1),
      value: z.number(),
    }),
  ),
});

export type SeoEstimatedImpact = z.infer<typeof seoEstimatedImpactSchema>;
export type SeoIntelligenceOutput = z.infer<typeof seoIntelligenceSchema>;
export type SeoIntelligenceEnrichedOutput = z.infer<typeof seoIntelligenceEnrichedSchema>;
export type SeoIntelligenceRecommendationDraft = z.infer<typeof seoIntelligenceRecommendationDraftSchema>;
export type SeoIntelligenceRecommendation = z.infer<typeof seoIntelligenceRecommendationSchema>;
export type SeoHealthExplanation = z.infer<typeof seoHealthExplanationSchema>;

export function buildSeoIntelligenceDeliverableFields(input: {
  facts: Pick<SeoIntelligenceFactsLike, "seoHealthScore" | "trafficOpportunity" | "visibilityOpportunity">;
  recommendations: Array<{ id: string; title: string; group: string; priority: number }>;
  technicalFindings: Array<{ title: string; severity: string }>;
  contentFindings: Array<{ title: string; severity: string }>;
}): Pick<
  SeoIntelligenceEnrichedOutput,
  | "criticalIssues"
  | "quickWins"
  | "longTermOpportunities"
  | "trafficOpportunity"
  | "visibilityOpportunity"
  | "seoTimeline"
> {
  const quickWins = input.recommendations
    .filter((item) => item.group === "Quick Wins")
    .map((item) => item.title);
  const criticalIssues = [...input.technicalFindings, ...input.contentFindings]
    .filter((item) => item.severity === "critical" || item.severity === "high")
    .map((item) => item.title);
  const longTermOpportunities = input.recommendations
    .filter((item) => item.group === "Long-Term SEO Strategy")
    .map((item) => item.title);

  return {
    criticalIssues,
    quickWins,
    longTermOpportunities,
    trafficOpportunity: input.facts.trafficOpportunity,
    visibilityOpportunity: input.facts.visibilityOpportunity,
    seoTimeline: [
      { label: "SEO Health", value: input.facts.seoHealthScore },
      { label: "Traffic Opportunity", value: input.facts.trafficOpportunity },
      { label: "Visibility Opportunity", value: input.facts.visibilityOpportunity },
    ],
  };
}

type SeoIntelligenceFactsLike = {
  seoHealthScore: number;
  trafficOpportunity: number;
  visibilityOpportunity: number;
};
