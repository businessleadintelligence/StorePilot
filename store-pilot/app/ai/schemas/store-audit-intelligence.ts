import { z } from "zod";

export const STORE_AUDIT_INTELLIGENCE_CATEGORIES = [
  "Homepage",
  "Store Performance",
  "Navigation",
  "Collections",
  "Product Pages",
  "Theme",
  "Apps",
  "SEO",
  "Technical SEO",
  "Images",
  "Trust Signals",
  "Policies",
  "Accessibility",
  "Mobile UX",
  "Checkout Preparation",
  "Conversion Optimization",
  "Merchant Best Practices",
] as const;

export const STORE_AUDIT_INTELLIGENCE_GROUPS = [
  "Critical Fixes",
  "Quick Wins",
  "SEO Improvements",
  "Performance Improvements",
  "Long-Term CRO",
] as const;

export const STORE_AUDIT_INTELLIGENCE_DIFFICULTIES = ["Easy", "Medium", "Hard"] as const;

export type StoreAuditIntelligenceCategory = (typeof STORE_AUDIT_INTELLIGENCE_CATEGORIES)[number];
export type StoreAuditIntelligenceGroup = (typeof STORE_AUDIT_INTELLIGENCE_GROUPS)[number];

export const storeAuditEstimatedImpactSchema = z.object({
  conversionLift: z.number().nullable().optional(),
  seoLift: z.number().nullable().optional(),
  performanceGain: z.number().nullable().optional(),
  accessibilityImprovement: z.number().nullable().optional(),
});

export type StoreAuditEstimatedImpact = z.infer<typeof storeAuditEstimatedImpactSchema>;

export const storeAuditVerificationSchema = z.object({
  expectedMetric: z.string().min(1),
  expectedDirection: z.enum(["Increase", "Decrease", "Stable"]),
  expectedWindow: z.string().min(1),
});

export const storeAuditRecommendationTimelineSchema = z.object({
  detected: z.string().min(1),
  created: z.string().min(1),
  viewed: z.string().nullable().optional(),
  implemented: z.string().nullable().optional(),
  verifying: z.string().nullable().optional(),
  verified: z.string().nullable().optional(),
  closed: z.string().nullable().optional(),
});

export const storeAuditHealthExplanationSchema = z.object({
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

export const storeAuditRecommendationGroupsSchema = z.object({
  criticalFixes: z.array(z.string().min(1)),
  quickWins: z.array(z.string().min(1)),
  seoImprovements: z.array(z.string().min(1)),
  performanceImprovements: z.array(z.string().min(1)),
  longTermCro: z.array(z.string().min(1)),
});

export const storeAuditFindingSchema = z.object({
  id: z.string().min(1),
  section: z.enum(STORE_AUDIT_INTELLIGENCE_CATEGORIES),
  title: z.string().min(1),
  detail: z.string().min(1),
  severity: z.enum(["low", "medium", "high", "critical"]),
  confidence: z.number().min(0).max(1),
});

export const storeAuditIntelligenceRecommendationDraftSchema = z.object({
  id: z.string().min(1),
  category: z.enum(STORE_AUDIT_INTELLIGENCE_CATEGORIES),
  title: z.string().min(5),
  reason: z.string().min(10),
  evidenceKeys: z.array(z.string().min(1)).min(1),
  merchantAction: z.array(z.string().min(1)).min(1),
  expectedResult: z.string().min(5),
  estimatedImpact: z.string().min(5),
  difficulty: z.enum(STORE_AUDIT_INTELLIGENCE_DIFFICULTIES),
  priority: z.number().int().min(1).max(5),
  confidence: z.number().min(0).max(1),
  verificationCriteria: z.string().min(5),
  timeline: z.string().min(1),
});

export const storeAuditIntelligenceRecommendationSchema =
  storeAuditIntelligenceRecommendationDraftSchema.extend({
    priorityScore: z.number().min(0).max(100),
    estimatedImpactMetrics: storeAuditEstimatedImpactSchema,
    evidence: z.array(z.string().min(1)).min(1),
    verification: storeAuditVerificationSchema,
    group: z.enum(STORE_AUDIT_INTELLIGENCE_GROUPS),
    recommendationTimeline: storeAuditRecommendationTimelineSchema,
    tasks: z.array(z.string().min(1)).min(1),
  });

export const storeAuditIntelligenceSchema = z.object({
  summary: z.string().min(1).max(500),
  priority: z.number().int().min(1).max(5),
  confidence: z.number().min(0).max(1),
  storeHealthScore: z.number().int().min(0).max(100),
  homepageScore: z.number().int().min(0).max(100),
  performanceScore: z.number().int().min(0).max(100),
  seoScore: z.number().int().min(0).max(100),
  accessibilityScore: z.number().int().min(0).max(100),
  conversionScore: z.number().int().min(0).max(100),
  mobileScore: z.number().int().min(0).max(100),
  themeScore: z.number().int().min(0).max(100),
  healthExplanation: storeAuditHealthExplanationSchema.optional(),
  findings: z.array(storeAuditFindingSchema),
  recommendations: z.array(storeAuditIntelligenceRecommendationDraftSchema).min(1),
  risks: z.array(z.string().min(1)),
  opportunities: z.array(z.string().min(1)),
  recommendationGroups: storeAuditRecommendationGroupsSchema.optional(),
});

export const storeAuditIntelligenceEnrichedSchema = storeAuditIntelligenceSchema.extend({
  healthExplanation: storeAuditHealthExplanationSchema,
  recommendationGroups: storeAuditRecommendationGroupsSchema,
  recommendations: z.array(storeAuditIntelligenceRecommendationSchema).min(1),
  overallAuditScore: z.number().int().min(0).max(100),
  navigationScore: z.number().int().min(0).max(100),
  trustScore: z.number().int().min(0).max(100),
  imageOptimizationScore: z.number().int().min(0).max(100),
  technicalSeoScore: z.number().int().min(0).max(100),
  policyScore: z.number().int().min(0).max(100),
  appBloatScore: z.number().int().min(0).max(100),
  merchantBestPracticesScore: z.number().int().min(0).max(100),
  quickWins: z.array(z.string().min(1)),
  criticalIssues: z.array(z.string().min(1)),
  longTermImprovements: z.array(z.string().min(1)),
  estimatedRevenueImpact: z.number().min(0),
  estimatedConversionImpact: z.number().min(0),
});

export type StoreAuditIntelligenceOutput = z.infer<typeof storeAuditIntelligenceSchema>;
export type StoreAuditIntelligenceEnrichedOutput = z.infer<typeof storeAuditIntelligenceEnrichedSchema>;
export type StoreAuditIntelligenceRecommendationDraft = z.infer<
  typeof storeAuditIntelligenceRecommendationDraftSchema
>;
export type StoreAuditIntelligenceRecommendation = z.infer<
  typeof storeAuditIntelligenceRecommendationSchema
>;
export type StoreAuditHealthExplanation = z.infer<typeof storeAuditHealthExplanationSchema>;
