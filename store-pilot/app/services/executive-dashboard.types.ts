import type { StoreHealthScore, StoreMetrics } from "../types/store-dashboard";

export const EXECUTIVE_RECOMMENDATION_GROUPS = [
  "Critical Risks",
  "Revenue Opportunities",
  "Quick Wins",
  "Operational Improvements",
  "Long-Term Strategy",
] as const;

export type ExecutiveRecommendationGroup = (typeof EXECUTIVE_RECOMMENDATION_GROUPS)[number];

export type ExecutiveEstimatedImpact = {
  revenueRecovered: number | null;
  revenueOpportunity: number | null;
  ordersProtected: number | null;
  inventoryDaysSaved: number | null;
  inventoryCostSaved: number | null;
  estimatedLostSales: number | null;
  marginImprovement: number | null;
};

export type ExecutiveDecisionView = {
  id: string;
  title: string;
  summary: string;
  reason: string;
  agentsInvolved: string[];
  supportingEvidence: string[];
  priority: number;
  confidence: number;
  risk: string;
  estimatedRevenueImpact: number;
  estimatedInventoryImpact: number;
  estimatedConversionImpact: number;
  merchantActions: string[];
  verificationCriteria: string;
  timeline: string;
  group: string;
  reinforced: boolean;
  requiresManualReview: boolean;
  hasConflict: boolean;
  hasDependency: boolean;
};

export type ExecutiveCollaborationSummary = {
  summary: string;
  overallHealth: number;
  overallConfidence: number;
  overallPriority: number;
  consensusScore: number;
  topRisk: string | null;
  topOpportunity: string | null;
  expectedImpact: {
    revenueLift: number;
    inventoryReduction: number;
    conversionImprovement: number;
  };
  conflictCount: number;
  dependencyCount: number;
};

export type ExecutiveCollaborationCharts = {
  consensusGauge: ExecutiveChartPoint[];
  agentInfluenceRadar: ExecutiveChartPoint[];
  dependencyGraph: ExecutiveChartPoint[];
  priorityMatrixImpact: ExecutiveChartPoint[];
  priorityMatrixEffort: ExecutiveChartPoint[];
  conflictHeatmap: ExecutiveChartPoint[];
  recommendationSankey: ExecutiveChartPoint[];
  decisionTimeline: ExecutiveChartPoint[];
  roiWaterfall: ExecutiveChartPoint[];
  healthWheel: ExecutiveChartPoint[];
  confidenceDistribution: ExecutiveChartPoint[];
};

export type ExecutiveRecommendationView = {
  stableId: string;
  id: string;
  subjectKey: string;
  productId: string | null;
  productTitle: string | null;
  title: string;
  reason: string;
  category: string;
  group: ExecutiveRecommendationGroup;
  priority: number;
  priorityScore: number;
  confidence: number;
  difficulty: string;
  evidence: string[];
  estimatedImpact: ExecutiveEstimatedImpact;
  merchantAction: string[];
  tasks: string[];
  timeline: Record<string, string | null>;
  status: string;
  verification: Record<string, unknown>;
  expectedResult: string;
  potentialRisk: string;
  estimatedTime: string;
  businessImpact: string;
  lastSeenAt: string;
  updatedAt: string;
};

export type ExecutiveSummaryCards = {
  storeHealth: number;
  revenueHealth: number;
  inventoryHealth: number;
  growthScore: number;
  aiConfidence: number;
  openRecommendations: number;
  highPriorityTasks: number;
};

export type ExecutiveBriefing = {
  greeting: string;
  storeHealth: number;
  summaryLines: string[];
  estimatedOpportunity: number;
  highestPriorities: string[];
};

export type ExecutiveProductSpotlight = {
  productId: string;
  title: string;
  healthScore: number | null;
  revenueTrend: string;
  inventoryDays: number | null;
  velocity: number | null;
  risk: string | null;
  opportunity: string | null;
  recommendations: ExecutiveRecommendationView[];
  expectedRevenueImpact: number;
  healthExplanation: Record<string, unknown> | null;
};

export type ExecutiveChartPoint = {
  label: string;
  value: number;
};

export type ExecutiveAnalytics = {
  revenueTrend: ExecutiveChartPoint[];
  inventoryTrend: ExecutiveChartPoint[];
  healthScoreHistory: ExecutiveChartPoint[];
  recommendationImpact: ExecutiveChartPoint[];
  topProducts: ExecutiveChartPoint[];
  bottomProducts: ExecutiveChartPoint[];
  velocityTrend: ExecutiveChartPoint[];
  refundTrend: ExecutiveChartPoint[];
  inventoryAge: ExecutiveChartPoint[];
  healthDistribution: ExecutiveChartPoint[];
  recommendationCompletionRate: number;
  inventoryHealthHistory: ExecutiveChartPoint[];
  deadStockCount: ExecutiveChartPoint[];
  stockCoverageTrend: ExecutiveChartPoint[];
  reorderTimeline: ExecutiveChartPoint[];
  inventoryRiskDistribution: ExecutiveChartPoint[];
  topBundleOpportunities: ExecutiveChartPoint[];
  bundleSuccessRate: ExecutiveChartPoint[];
  potentialInventoryReduction: ExecutiveChartPoint[];
  potentialAttachRate: ExecutiveChartPoint[];
  bundleHealth: ExecutiveChartPoint[];
  abcDistribution: ExecutiveChartPoint[];
  weeksOfCover: ExecutiveChartPoint[];
  capitalLocked: ExecutiveChartPoint[];
  inventoryTimeline: ExecutiveChartPoint[];
  storeAuditHealth: ExecutiveChartPoint[];
  homepageScore: ExecutiveChartPoint[];
  seoScoreHistory: ExecutiveChartPoint[];
  accessibilityScoreHistory: ExecutiveChartPoint[];
  performanceScoreHistory: ExecutiveChartPoint[];
  themeScoreHistory: ExecutiveChartPoint[];
  conversionScoreHistory: ExecutiveChartPoint[];
  mobileScoreHistory: ExecutiveChartPoint[];
  storeAuditIssueDistribution: ExecutiveChartPoint[];
  storeAuditRecommendationTrend: ExecutiveChartPoint[];
  trendHealth: ExecutiveChartPoint[];
  emergingProductsTrend: ExecutiveChartPoint[];
  decliningProductsTrend: ExecutiveChartPoint[];
  momentumTrend: ExecutiveChartPoint[];
  growthVsDeclineTrend: ExecutiveChartPoint[];
  trendRevenueTrend: ExecutiveChartPoint[];
  trendVelocityTrend: ExecutiveChartPoint[];
  seasonalityTrend: ExecutiveChartPoint[];
  categoryTrendChart: ExecutiveChartPoint[];
  trendTimeline: ExecutiveChartPoint[];
  seoIntelligenceHealthHistory: ExecutiveChartPoint[];
  seoVisibilityTrend: ExecutiveChartPoint[];
  seoCtrTrend: ExecutiveChartPoint[];
  seoOrganicOpportunity: ExecutiveChartPoint[];
  seoCoreWebVitalsTrend: ExecutiveChartPoint[];
  seoTechnicalRadar: ExecutiveChartPoint[];
  seoIssueDistribution: ExecutiveChartPoint[];
  seoKeywordDistribution: ExecutiveChartPoint[];
  seoPositionTrend: ExecutiveChartPoint[];
  seoIndexCoverage: ExecutiveChartPoint[];
  seoContentQuality: ExecutiveChartPoint[];
  seoHealthTimeline: ExecutiveChartPoint[];
  pricingHealthHistory: ExecutiveChartPoint[];
  marginTrend: ExecutiveChartPoint[];
  revenueVsProfit: ExecutiveChartPoint[];
  discountTrend: ExecutiveChartPoint[];
  priceDistribution: ExecutiveChartPoint[];
  pricingRisk: ExecutiveChartPoint[];
  pricingOpportunityFunnel: ExecutiveChartPoint[];
  marginDistribution: ExecutiveChartPoint[];
  discountDependenceTrend: ExecutiveChartPoint[];
  pricingTimeline: ExecutiveChartPoint[];
};

export type ExecutiveTimelineEvent = {
  id: string;
  stableId: string;
  recommendationId: string;
  title: string;
  type:
    | "detected"
    | "viewed"
    | "implemented"
    | "verified"
    | "closed"
    | "metrics_improved"
    | "dismissed";
  message: string;
  at: string;
};

export type ExecutiveTask = {
  id: string;
  title: string;
  priority: number;
  estimatedImpact: number;
  difficulty: string;
  relatedRecommendationId: string;
  relatedRecommendationTitle: string;
  stableId: string;
  subjectKey: string;
};

export type ExecutiveStoreAuditPanel = {
  overallAuditScore: number;
  auditHealth: number;
  criticalIssues: number;
  seoHealth: number;
  performanceHealth: number;
  accessibilityHealth: number;
  auditHistory: ExecutiveChartPoint[];
  auditTimeline: ExecutiveChartPoint[];
  trendChart: ExecutiveChartPoint[];
};

export type ExecutiveSeoIntelligencePanel = {
  seoHealth: number;
  seoTrend: ExecutiveChartPoint[];
  organicOpportunity: number;
  searchVisibility: number;
  coreWebVitals: number;
  technicalSeo: number;
  contentQuality: number;
  indexCoverage: number;
  structuredData: number;
  quickWins: ExecutiveChartPoint[];
  opportunityTimeline: ExecutiveChartPoint[];
  seoHistory: ExecutiveChartPoint[];
};

export type ExecutivePricingIntelligencePanel = {
  pricingHealth: number;
  marginPercent: number;
  profitOpportunity: number;
  revenueOpportunity: number;
  averageDiscountPercent: number;
  discountDependence: number;
  pricingHealthTrend: ExecutiveChartPoint[];
  marginTrend: ExecutiveChartPoint[];
  revenueVsProfit: ExecutiveChartPoint[];
  discountTrend: ExecutiveChartPoint[];
  priceDistribution: ExecutiveChartPoint[];
  pricingRisk: ExecutiveChartPoint[];
  opportunityFunnel: ExecutiveChartPoint[];
  marginDistribution: ExecutiveChartPoint[];
  discountDependenceTrend: ExecutiveChartPoint[];
  pricingTimeline: ExecutiveChartPoint[];
  criticalPricingRisks: ExecutiveChartPoint[];
};

export type ExecutiveGrowthIntelligencePanel = {
  growthScore: number;
  monthlyRevenueOpportunity: number;
  aovOpportunity: number;
  repeatPurchaseOpportunity: number;
  expansionReadiness: number;
  growthTrend: ExecutiveChartPoint[];
  opportunityFunnel: ExecutiveChartPoint[];
  growthCategories: ExecutiveChartPoint[];
  revenueLiftForecast: ExecutiveChartPoint[];
  growthRoi: ExecutiveChartPoint[];
  campaignTimeline: ExecutiveChartPoint[];
  collectionPerformance: ExecutiveChartPoint[];
  growthCapacity: ExecutiveChartPoint[];
  revenueSources: ExecutiveChartPoint[];
  priorityDistribution: ExecutiveChartPoint[];
  criticalGrowthRisks: ExecutiveChartPoint[];
};

export type ExecutiveCooPanel = {
  todaysPriority: string | null;
  businessHealth: number;
  executiveConfidence: number;
  merchantCapacity: number;
  businessMomentum: number;
  criticalPathLength: number;
  executionTimeline: ExecutiveChartPoint[];
  priorityDistribution: ExecutiveChartPoint[];
  businessHealthTrend: ExecutiveChartPoint[];
  capacityUsage: ExecutiveChartPoint[];
  opportunityCostChart: ExecutiveChartPoint[];
  dependencyGraph: ExecutiveChartPoint[];
  executionFunnel: ExecutiveChartPoint[];
  businessMomentumChart: ExecutiveChartPoint[];
  criticalPathChart: ExecutiveChartPoint[];
  blockedTasksChart: ExecutiveChartPoint[];
};

export type ExecutiveDashboardData = {
  summaryCards: ExecutiveSummaryCards;
  briefing: ExecutiveBriefing;
  groupedRecommendations: Record<ExecutiveRecommendationGroup, ExecutiveRecommendationView[]>;
  executiveDecisions: ExecutiveDecisionView[];
  collaborationSummary: ExecutiveCollaborationSummary | null;
  collaborationCharts: ExecutiveCollaborationCharts | null;
  productSpotlight: ExecutiveProductSpotlight | null;
  analytics: ExecutiveAnalytics;
  storeAuditPanel: ExecutiveStoreAuditPanel;
  seoIntelligencePanel: ExecutiveSeoIntelligencePanel;
  pricingIntelligencePanel: ExecutivePricingIntelligencePanel;
  growthIntelligencePanel: ExecutiveGrowthIntelligencePanel;
  executiveCooPanel: ExecutiveCooPanel;
  timeline: ExecutiveTimelineEvent[];
  tasks: ExecutiveTask[];
  recommendations: ExecutiveRecommendationView[];
  storeHealthScore: StoreHealthScore;
  metrics: StoreMetrics;
  currency: string;
  lastUpdatedAt: string | null;
};

