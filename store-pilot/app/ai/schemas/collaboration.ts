import { z } from "zod";
import { COLLABORATION_EXECUTIVE_GROUPS, COLLABORATION_SOURCE_AGENTS } from "../collaboration/collaboration-types";

export const collaborationEvidenceSchema = z.object({
  key: z.string().min(1),
  sourceAgent: z.enum(COLLABORATION_SOURCE_AGENTS),
  factReference: z.string().min(1),
  confidence: z.number().min(0).max(1),
  label: z.string().min(1),
});

export const collaborationExecutiveActionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(8),
  summary: z.string().min(8),
  reason: z.string().min(8),
  agentsInvolved: z.array(z.enum(COLLABORATION_SOURCE_AGENTS)).min(1),
  supportingEvidence: z.array(collaborationEvidenceSchema).min(1),
  sourceRecommendationIds: z.array(z.string().min(1)).min(1),
  priority: z.number().int().min(1).max(5),
  confidence: z.number().min(0).max(1),
  risk: z.enum(["low", "medium", "high"]),
  estimatedRevenueImpact: z.number().min(0),
  estimatedInventoryImpact: z.number(),
  estimatedConversionImpact: z.number(),
  estimatedDifficulty: z.string().min(1),
  merchantActions: z.array(z.string().min(3)).min(1),
  verificationCriteria: z.string().min(8),
  timeline: z.string().min(3),
  group: z.enum(COLLABORATION_EXECUTIVE_GROUPS),
  reinforced: z.boolean(),
  requiresManualReview: z.boolean(),
  priorityScore: z.number().optional(),
});

export const collaborationConflictSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(8),
  agents: z.array(z.enum(COLLABORATION_SOURCE_AGENTS)).min(2),
  recommendations: z.array(z.string().min(1)).min(2),
  reason: z.string().min(8),
  resolution: z.string().min(8),
  severity: z.enum(["low", "medium", "high"]),
});

export const collaborationDependencySchema = z.object({
  id: z.string().min(1),
  recommendationId: z.string().min(1),
  dependsOn: z.array(z.string().min(1)).min(1),
  reason: z.string().min(8),
});

export const collaborationExpectedImpactSchema = z.object({
  revenueLift: z.number(),
  inventoryReduction: z.number(),
  conversionImprovement: z.number(),
});

export const collaborationSchema = z.object({
  summary: z.string().min(8),
  overallHealth: z.number().min(0).max(100),
  overallConfidence: z.number().min(0).max(1),
  overallPriority: z.number().int().min(1).max(5),
  consensusScore: z.number().min(0).max(1),
  executiveActions: z.array(collaborationExecutiveActionSchema).min(1),
  conflicts: z.array(collaborationConflictSchema),
  dependencies: z.array(collaborationDependencySchema),
  recommendationGroups: z.array(
    z.object({
      group: z.enum(COLLABORATION_EXECUTIVE_GROUPS),
      actionIds: z.array(z.string().min(1)),
    }),
  ),
  opportunities: z.array(z.string().min(3)),
  risks: z.array(z.string().min(3)),
  expectedImpact: collaborationExpectedImpactSchema,
  timeline: z.record(z.string(), z.string().nullable()),
  topRisk: z.string().nullable(),
  topOpportunity: z.string().nullable(),
});

export type CollaborationOutputSchema = z.infer<typeof collaborationSchema>;
