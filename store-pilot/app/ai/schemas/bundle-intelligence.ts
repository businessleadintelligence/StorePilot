import { z } from "zod";

export const BUNDLE_INTELLIGENCE_CATEGORIES = [
  "Starter Kit",
  "Accessory Bundle",
  "Quantity Bundle",
  "Seasonal Bundle",
  "Dead Inventory Bundle",
  "High Margin Bundle",
  "Merchandising",
  "Clearance Bundle",
] as const;

export const BUNDLE_INTELLIGENCE_GROUPS = [
  "Top Bundle Opportunities",
  "Quick Win Bundles",
  "Inventory Recovery Bundles",
  "High Margin Bundles",
  "Long-Term Merchandising",
] as const;

export const BUNDLE_INTELLIGENCE_DIFFICULTIES = ["Easy", "Medium", "Hard"] as const;

export type BundleIntelligenceCategory = (typeof BUNDLE_INTELLIGENCE_CATEGORIES)[number];
export type BundleIntelligenceGroup = (typeof BUNDLE_INTELLIGENCE_GROUPS)[number];

export const bundleEstimatedImpactSchema = z.object({
  attachRateLift: z.number().nullable().optional(),
  inventoryUnitsReduced: z.number().nullable().optional(),
  bundleOrdersExpected: z.number().nullable().optional(),
  estimatedBundleValue: z.number().nullable().optional(),
});

export type BundleEstimatedImpact = z.infer<typeof bundleEstimatedImpactSchema>;

export const bundleVerificationSchema = z.object({
  expectedMetric: z.string().min(1),
  expectedDirection: z.enum(["Increase", "Decrease", "Stable"]),
  expectedWindow: z.string().min(1),
});

export const bundleRecommendationTimelineSchema = z.object({
  detected: z.string().min(1),
  created: z.string().min(1),
  viewed: z.string().nullable().optional(),
  implemented: z.string().nullable().optional(),
  verifying: z.string().nullable().optional(),
  verified: z.string().nullable().optional(),
  closed: z.string().nullable().optional(),
});

export const bundleHealthExplanationSchema = z.object({
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

export const bundleRecommendationGroupsSchema = z.object({
  topBundleOpportunities: z.array(z.string().min(1)),
  quickWinBundles: z.array(z.string().min(1)),
  inventoryRecoveryBundles: z.array(z.string().min(1)),
  highMarginBundles: z.array(z.string().min(1)),
  longTermMerchandising: z.array(z.string().min(1)),
});

export const bundleCandidateSchema = z.object({
  id: z.string().min(1),
  productIds: z.array(z.string().min(1)).min(2),
  titles: z.array(z.string().min(1)).min(2),
  bundleType: z.string().min(1),
  confidence: z.number().min(0).max(1),
  attachRate: z.number().min(0).max(1),
  complexity: z.enum(["simple", "moderate", "complex"]),
  inventoryCompatible: z.boolean(),
  expectedInventoryReduction: z.number().min(0),
  potentialAttachRate: z.number().min(0).max(1),
});

export const bundleIntelligenceRecommendationDraftSchema = z.object({
  id: z.string().min(1),
  category: z.enum(BUNDLE_INTELLIGENCE_CATEGORIES),
  title: z.string().min(5),
  reason: z.string().min(10),
  bundleProductIds: z.array(z.string().min(1)).min(2),
  evidenceKeys: z.array(z.string().min(1)).min(1),
  merchantAction: z.array(z.string().min(1)).min(1),
  estimatedDifficulty: z.enum(BUNDLE_INTELLIGENCE_DIFFICULTIES),
  confidence: z.number().min(0).max(1),
  expectedResult: z.string().min(5),
  potentialRisk: z.string().min(5),
  estimatedTime: z.string().min(1),
  businessImpact: z.string().min(5),
});

export const bundleIntelligenceRecommendationSchema =
  bundleIntelligenceRecommendationDraftSchema.extend({
    priority: z.number().int().min(1).max(5),
    priorityScore: z.number().min(0).max(100),
    estimatedImpact: bundleEstimatedImpactSchema,
    evidence: z.array(z.string().min(1)).min(1),
    verification: bundleVerificationSchema,
    group: z.enum(BUNDLE_INTELLIGENCE_GROUPS),
    timeline: bundleRecommendationTimelineSchema,
    tasks: z.array(z.string().min(1)).min(1),
    expectedImpact: z.string().min(5).optional(),
  });

export const bundleFindingSchema = z.object({
  id: z.string().min(1),
  category: z.enum(BUNDLE_INTELLIGENCE_CATEGORIES),
  title: z.string().min(1),
  detail: z.string().min(1),
  severity: z.enum(["low", "medium", "high", "critical"]),
  confidence: z.number().min(0).max(1),
});

export const bundleIntelligenceSchema = z.object({
  summary: z.string().min(1).max(500),
  priority: z.number().int().min(1).max(5),
  confidence: z.number().min(0).max(1),
  bundleHealthScore: z.number().int().min(0).max(100),
  healthExplanation: bundleHealthExplanationSchema.optional(),
  bundleCandidates: z.array(bundleCandidateSchema),
  recommendations: z.array(bundleIntelligenceRecommendationDraftSchema).min(1),
  risks: z.array(z.string().min(1)),
  opportunities: z.array(z.string().min(1)),
  findings: z.array(bundleFindingSchema),
  recommendationGroups: bundleRecommendationGroupsSchema.optional(),
});

export const bundleIntelligenceEnrichedSchema = bundleIntelligenceSchema.extend({
  healthExplanation: bundleHealthExplanationSchema,
  recommendationGroups: bundleRecommendationGroupsSchema,
  recommendations: z.array(bundleIntelligenceRecommendationSchema).min(1),
  potentialAttachRate: z.number().nullable().optional(),
  potentialInventoryReduction: z.number().nullable().optional(),
  bundleSuccessRate: z.number().nullable().optional(),
});

export type BundleIntelligenceOutput = z.infer<typeof bundleIntelligenceSchema>;
export type BundleIntelligenceEnrichedOutput = z.infer<typeof bundleIntelligenceEnrichedSchema>;
export type BundleIntelligenceRecommendationDraft = z.infer<
  typeof bundleIntelligenceRecommendationDraftSchema
>;
export type BundleIntelligenceRecommendation = z.infer<typeof bundleIntelligenceRecommendationSchema>;
export type BundleHealthExplanation = z.infer<typeof bundleHealthExplanationSchema>;
