export const COLLABORATION_SOURCE_AGENTS = [
  "product_intelligence",
  "inventory_intelligence",
  "bundle_discovery",
  "store_audit",
  "trend_intelligence",
  "seo_audit",
  "pricing_intelligence",
  "growth_intelligence",
] as const;

export type CollaborationSourceAgent = (typeof COLLABORATION_SOURCE_AGENTS)[number];

export const COLLABORATION_EXECUTIVE_GROUPS = [
  "Critical",
  "Revenue",
  "Growth",
  "Inventory",
  "Conversion",
  "Marketing",
  "SEO",
  "Store Health",
  "Quick Wins",
  "Long-Term",
] as const;

export type CollaborationExecutiveGroup = (typeof COLLABORATION_EXECUTIVE_GROUPS)[number];

export type CollaborationRecommendationInput = {
  stableId: string;
  recommendationId: string;
  agentId: CollaborationSourceAgent;
  subjectKey: string;
  productId: string | null;
  title: string;
  reason: string;
  category: string;
  group: string;
  priority: number;
  priorityScore: number;
  confidence: number;
  difficulty: string;
  status: string;
  evidence: string[];
  evidenceKeys: string[];
  merchantAction: string[];
  expectedResult: string;
  estimatedImpact: CollaborationImpactMetrics;
  verificationCriteria: string;
  timeline: string;
  productTitle: string | null;
};

export type CollaborationImpactMetrics = {
  revenueOpportunity: number;
  revenueRecovered: number;
  inventoryReduction: number;
  conversionLift: number;
  ordersProtected: number;
};

export type CollaborationMemoryState = {
  implementedIds: Set<string>;
  dismissedIds: Set<string>;
  ignoredIds: Set<string>;
  snoozedIds: Set<string>;
  openIds: Set<string>;
  implementedExecutiveIds: Set<string>;
  dismissedExecutiveIds: Set<string>;
  merchantPreferences: Record<string, unknown>;
};

export type CollaborationAgentResultSnapshot = {
  agentId: CollaborationSourceAgent;
  subjectKey: string;
  summary: string | null;
  healthScore: number | null;
  confidence: number | null;
  resultJson: Record<string, unknown>;
  createdAt: string;
};

export type CollaborationContext = {
  storeId: string;
  subjectKey: string;
  computedAt: string;
  recommendations: CollaborationRecommendationInput[];
  agentResults: CollaborationAgentResultSnapshot[];
  memory: CollaborationMemoryState;
  storeMetrics: {
    storeHealth: number;
    revenueHealth: number;
    inventoryHealth: number;
    growthScore: number;
  };
};

export type CollaborationEvidenceItem = {
  key: string;
  sourceAgent: CollaborationSourceAgent;
  factReference: string;
  confidence: number;
  label: string;
};

export type CollaborationExecutiveAction = {
  id: string;
  title: string;
  summary: string;
  reason: string;
  agentsInvolved: CollaborationSourceAgent[];
  supportingEvidence: CollaborationEvidenceItem[];
  sourceRecommendationIds: string[];
  priority: number;
  confidence: number;
  risk: "low" | "medium" | "high";
  estimatedRevenueImpact: number;
  estimatedInventoryImpact: number;
  estimatedConversionImpact: number;
  estimatedDifficulty: string;
  merchantActions: string[];
  verificationCriteria: string;
  timeline: string;
  group: CollaborationExecutiveGroup;
  reinforced: boolean;
  requiresManualReview: boolean;
  priorityScore?: number;
};

export type CollaborationConflict = {
  id: string;
  title: string;
  agents: CollaborationSourceAgent[];
  recommendations: string[];
  reason: string;
  resolution: string;
  severity: "low" | "medium" | "high";
};

export type CollaborationDependency = {
  id: string;
  recommendationId: string;
  dependsOn: string[];
  reason: string;
};

export type CollaborationExpectedImpact = {
  revenueLift: number;
  inventoryReduction: number;
  conversionImprovement: number;
};

export type CollaborationRecommendationGroup = {
  group: CollaborationExecutiveGroup;
  actionIds: string[];
};

export type CollaborationOutput = {
  summary: string;
  overallHealth: number;
  overallConfidence: number;
  overallPriority: number;
  consensusScore: number;
  executiveActions: CollaborationExecutiveAction[];
  conflicts: CollaborationConflict[];
  dependencies: CollaborationDependency[];
  recommendationGroups: CollaborationRecommendationGroup[];
  opportunities: string[];
  risks: string[];
  expectedImpact: CollaborationExpectedImpact;
  timeline: Record<string, string | null>;
  topRisk: string | null;
  topOpportunity: string | null;
};

export type CollaborationChartData = {
  consensusGauge: Array<{ label: string; value: number }>;
  agentInfluenceRadar: Array<{ label: string; value: number }>;
  dependencyGraph: Array<{ label: string; value: number }>;
  priorityMatrix: Array<{ label: string; impact: number; effort: number }>;
  conflictHeatmap: Array<{ label: string; value: number }>;
  recommendationSankey: Array<{ label: string; value: number }>;
  decisionTimeline: Array<{ label: string; value: number }>;
  roiWaterfall: Array<{ label: string; value: number }>;
  healthWheel: Array<{ label: string; value: number }>;
  confidenceDistribution: Array<{ label: string; value: number }>;
};
