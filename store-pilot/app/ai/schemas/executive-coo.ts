import { z } from "zod";
import { COLLABORATION_SOURCE_AGENTS } from "../collaboration/collaboration-types";

export const EXECUTIVE_COO_FOCUS_AREAS = [
  "Operations",
  "Revenue",
  "Inventory",
  "Growth",
  "Product",
  "Fulfillment",
  "Marketing",
  "Store Health",
  "Risk Mitigation",
  "Strategic Planning",
] as const;

export const EXECUTIVE_COO_GROUPS = [
  "Critical Operations",
  "Revenue Recovery",
  "Inventory Stabilization",
  "Growth Acceleration",
  "Product Optimization",
  "Customer Experience",
  "Marketing Efficiency",
  "Quick Wins",
  "Long-Term Strategy",
] as const;

export const EXECUTIVE_COO_DIFFICULTIES = ["Easy", "Medium", "Hard"] as const;

export type ExecutiveCooFocusArea = (typeof EXECUTIVE_COO_FOCUS_AREAS)[number];
export type ExecutiveCooGroup = (typeof EXECUTIVE_COO_GROUPS)[number];

export const executiveCooEstimatedImpactSchema = z.object({
  revenueOpportunity: z.number().nullable().optional(),
  revenueRecovered: z.number().nullable().optional(),
  inventoryReduction: z.number().nullable().optional(),
  conversionLift: z.number().nullable().optional(),
  ordersProtected: z.number().nullable().optional(),
});

export const executiveCooVerificationSchema = z.object({
  expectedMetric: z.string().min(1),
  expectedDirection: z.enum(["Increase", "Decrease", "Stable"]),
  expectedWindow: z.string().min(1),
});

export const executiveCooPriorityTimelineSchema = z.object({
  detected: z.string().min(1),
  created: z.string().min(1),
  viewed: z.string().nullable().optional(),
  implemented: z.string().nullable().optional(),
  verifying: z.string().nullable().optional(),
  verified: z.string().nullable().optional(),
  closed: z.string().nullable().optional(),
});

export const executiveCooHealthExplanationSchema = z.object({
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

export const executiveCooFocusAreaGroupsSchema = z.object({
  criticalOperations: z.array(z.string().min(1)),
  revenueRecovery: z.array(z.string().min(1)),
  inventoryStabilization: z.array(z.string().min(1)),
  growthAcceleration: z.array(z.string().min(1)),
  productOptimization: z.array(z.string().min(1)),
  customerExperience: z.array(z.string().min(1)),
  marketingEfficiency: z.array(z.string().min(1)),
  quickWins: z.array(z.string().min(1)),
  longTermStrategy: z.array(z.string().min(1)),
});

export const executiveCooFindingSchema = z.object({
  id: z.string().min(1),
  focusArea: z.enum(EXECUTIVE_COO_FOCUS_AREAS),
  title: z.string().min(1),
  detail: z.string().min(1),
  severity: z.enum(["low", "medium", "high", "critical"]),
  confidence: z.number().min(0).max(1),
});

export const executiveCooTopPriorityDraftSchema = z.object({
  id: z.string().min(1),
  focusArea: z.enum(EXECUTIVE_COO_FOCUS_AREAS),
  title: z.string().min(5),
  reason: z.string().min(10),
  supportingAgents: z.array(z.enum(COLLABORATION_SOURCE_AGENTS)).min(1),
  sourceRecommendationIds: z.array(z.string().min(1)).min(1),
  evidenceKeys: z.array(z.string().min(1)).min(1),
  merchantAction: z.array(z.string().min(1)).min(1),
  expectedResult: z.string().min(5),
  estimatedImpact: z.string().min(5),
  difficulty: z.enum(EXECUTIVE_COO_DIFFICULTIES),
  priority: z.number().int().min(1).max(5),
  confidence: z.number().min(0).max(1),
  verificationCriteria: z.string().min(5),
  timeline: z.string().min(1),
  executionOrder: z.number().int().min(1),
  dependsOn: z.array(z.string().min(1)).default([]),
});

export const executiveCooTopPrioritySchema = executiveCooTopPriorityDraftSchema.extend({
  priorityScore: z.number().min(0).max(100),
  estimatedImpactMetrics: executiveCooEstimatedImpactSchema,
  evidence: z.array(z.string().min(1)).min(1),
  verification: executiveCooVerificationSchema,
  group: z.enum(EXECUTIVE_COO_GROUPS),
  priorityTimeline: executiveCooPriorityTimelineSchema,
  tasks: z.array(z.string().min(1)).min(1),
  estimatedRevenueGain: z.number().min(0),
  estimatedInventoryReduction: z.number().min(0),
  estimatedConversionLift: z.number().min(0),
  estimatedImplementationTime: z.string().min(1),
});

export const executiveCooSchema = z.object({
  summary: z.string().min(1).max(500),
  priority: z.number().int().min(1).max(5),
  confidence: z.number().min(0).max(1),
  operationsHealthScore: z.number().int().min(0).max(100),
  findings: z.array(executiveCooFindingSchema),
  topPriorities: z.array(executiveCooTopPriorityDraftSchema).min(1),
  risks: z.array(z.string().min(1)),
  opportunities: z.array(z.string().min(1)),
  operationalPlan: z.string().min(10),
  executionSequence: z.array(z.string().min(1)).optional(),
  healthExplanation: executiveCooHealthExplanationSchema.optional(),
  focusAreaGroups: executiveCooFocusAreaGroupsSchema.optional(),
});

export const EXECUTIVE_COO_CATEGORIES = EXECUTIVE_COO_FOCUS_AREAS;

export const executiveCooBlockerSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  type: z.enum(["operation", "dependency", "conflict", "capacity"]),
  reason: z.string().min(1),
  severity: z.enum(["low", "medium", "high"]),
  blockedTaskIds: z.array(z.string().min(1)),
});

export const executiveCooDependencySchema = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  reason: z.string().min(1),
});

export const executiveCooOpportunityCostSchema = z.object({
  opportunityCostScore: z.number().min(0).max(100),
  estimatedRevenueCost: z.number().min(0),
  estimatedProfitCost: z.number().min(0),
});

export const executiveCooMerchantCapacitySchema = z.object({
  merchantCapacityScore: z.number().min(0).max(100),
  executionCapacityScore: z.number().min(0).max(100),
  availableSlots: z.number().min(0),
  overloadRisk: z.enum(["low", "medium", "high"]),
});

export const executiveCooExpectedBusinessImpactSchema = z.object({
  expectedRoi: z.number().min(0).max(100),
  revenueImpact: z.number().min(0),
  profitImpact: z.number().min(0),
  paybackDays: z.number().min(0),
});

export const executiveCooDeliverablePrioritySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(5),
  summary: z.string().min(10),
  reason: z.string().min(10),
  expectedImpact: z.string().min(5),
  priority: z.number().int().min(1).max(5),
  confidence: z.number().min(0).max(1),
  difficulty: z.enum(EXECUTIVE_COO_DIFFICULTIES),
  blockedBy: z.array(z.string().min(1)),
  dependencies: z.array(z.string().min(1)),
  executionOrder: z.number().int().min(1),
  merchantAction: z.array(z.string().min(1)).min(1),
  verification: executiveCooVerificationSchema,
  timeline: z.string().min(1),
  supportingAgents: z.array(z.string().min(1)).min(1),
  supportingEvidence: z.array(z.string().min(1)).min(1),
});

export const executiveCooDeliverableSchema = z.object({
  dailyBriefing: z.array(z.string().min(1)).min(1),
  weeklyPlan: z.array(z.string().min(1)).min(1),
  monthlyObjectives: z.array(z.string().min(1)).min(1),
  topPriorities: z.array(executiveCooDeliverablePrioritySchema).min(1),
  businessHealthSummary: executiveCooHealthExplanationSchema,
  merchantCapacity: executiveCooMerchantCapacitySchema,
  businessMomentum: z.number().int().min(0).max(100),
  executiveConfidence: z.number().min(0).max(1),
  executionOrder: z.array(z.string().min(1)).min(1),
  blockers: z.array(executiveCooBlockerSchema),
  dependencies: z.array(executiveCooDependencySchema),
  opportunityCost: executiveCooOpportunityCostSchema,
  focusAreas: z.array(z.string().min(1)).min(1),
  executiveNarrative: z.string().min(20),
  recommendedActions: z.array(z.string().min(1)).min(1),
  expectedBusinessImpact: executiveCooExpectedBusinessImpactSchema,
});

export const executiveCooEnrichedSchema = executiveCooSchema.extend({
  healthExplanation: executiveCooHealthExplanationSchema,
  focusAreaGroups: executiveCooFocusAreaGroupsSchema,
  topPriorities: z.array(executiveCooTopPrioritySchema).min(1),
  criticalOperationalRisks: z.array(z.string().min(1)),
  quickOperationalWins: z.array(z.string().min(1)),
  strategicOpportunities: z.array(z.string().min(1)),
  revenueOpportunity: z.number().min(0),
  inventoryRisk: z.number().min(0),
  operationsTimeline: z.array(
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
  businessHealthScore: z.number().int().min(0).max(100).optional(),
  executiveHealthScore: z.number().int().min(0).max(100).optional(),
  businessMomentum: z.number().int().min(0).max(100).optional(),
  growthMomentum: z.number().int().min(0).max(100).optional(),
  executionReadiness: z.number().int().min(0).max(100).optional(),
  automationReadiness: z.number().int().min(0).max(100).optional(),
  focusScore: z.number().int().min(0).max(100).optional(),
  businessUrgency: z.number().int().min(0).max(100).optional(),
  deliverable: executiveCooDeliverableSchema.optional(),
});

export type ExecutiveCooEstimatedImpact = z.infer<typeof executiveCooEstimatedImpactSchema>;
export type ExecutiveCooOutput = z.infer<typeof executiveCooSchema>;
export type ExecutiveCooEnrichedOutput = z.infer<typeof executiveCooEnrichedSchema>;
export type ExecutiveCooTopPriorityDraft = z.infer<typeof executiveCooTopPriorityDraftSchema>;
export type ExecutiveCooTopPriority = z.infer<typeof executiveCooTopPrioritySchema>;
export type ExecutiveCooHealthExplanation = z.infer<typeof executiveCooHealthExplanationSchema>;
export type ExecutiveCooDeliverableOutput = z.infer<typeof executiveCooDeliverableSchema>;
export type ExecutiveCooCategory = ExecutiveCooFocusArea;

export type ExecutiveCooRecommendationDraft = ExecutiveCooTopPriorityDraft;
export type ExecutiveCooRecommendation = ExecutiveCooTopPriority;
export type GrowthEstimatedImpact = ExecutiveCooEstimatedImpact;

export const executiveCooRecommendationDraftSchema = executiveCooTopPriorityDraftSchema;
export const executiveCooRecommendationSchema = executiveCooTopPrioritySchema;

export function buildExecutiveCooDeliverableFields(input: {
  facts: Pick<ExecutiveCooFactsLike, "operationsHealthScore" | "revenueOpportunity" | "inventoryRisk">;
  topPriorities: Array<{ id: string; title: string; group: string; priority: number }>;
  findings: Array<{ title: string; severity: string }>;
}): Pick<
  ExecutiveCooEnrichedOutput,
  | "criticalOperationalRisks"
  | "quickOperationalWins"
  | "strategicOpportunities"
  | "revenueOpportunity"
  | "inventoryRisk"
  | "operationsTimeline"
> {
  const quickOperationalWins = input.topPriorities
    .filter((item) => item.group === "Quick Wins")
    .map((item) => item.title);
  const criticalOperationalRisks = input.findings
    .filter((item) => item.severity === "critical" || item.severity === "high")
    .map((item) => item.title);
  const strategicOpportunities = input.topPriorities
    .filter((item) => item.group === "Long-Term Strategy")
    .map((item) => item.title);

  return {
    criticalOperationalRisks,
    quickOperationalWins,
    strategicOpportunities,
    revenueOpportunity: input.facts.revenueOpportunity,
    inventoryRisk: input.facts.inventoryRisk,
    operationsTimeline: [
      { label: "Operations Health", value: input.facts.operationsHealthScore },
      { label: "Revenue Opportunity", value: input.facts.revenueOpportunity },
      { label: "Inventory Risk", value: input.facts.inventoryRisk },
    ],
  };
}

type ExecutiveCooFactsLike = {
  operationsHealthScore: number;
  revenueOpportunity: number;
  inventoryRisk: number;
};
