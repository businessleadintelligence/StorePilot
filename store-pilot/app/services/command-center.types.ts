import type {
  ExecutiveChartPoint,
  ExecutiveDashboardData,
  ExecutiveRecommendationView,
} from "./executive-dashboard.types";

export type CommandCenterActivityTone = "success" | "warning" | "danger" | "info";

export type CommandCenterActivityItem = {
  id: string;
  tone: CommandCenterActivityTone;
  title: string;
  detail: string;
  metrics: Array<{ label: string; value: string }>;
  at: string;
};

export type CommandCenterAgentCard = {
  id: string;
  name: string;
  status: "healthy" | "waiting" | "coming_soon";
  description: string;
  lastRunAt: string | null;
  durationMs: number | null;
  recommendationCount: number | null;
  costUsd: number | null;
  latencyMs: number | null;
  healthLabel: string | null;
};

export type CommandCenterHealthSegment = {
  label: string;
  value: number;
};

export type CommandCenterHealthRing = {
  score: number;
  segments: CommandCenterHealthSegment[];
};

export type CommandCenterCostWidget = {
  creditsUsed: number;
  remainingCredits: number;
  creditLimit: number;
  estimatedValueGenerated: number;
};

export type CommandCenterBriefing = {
  headline: string;
  paragraphs: string[];
};

export type CommandCenterTimelineItem = {
  id: string;
  timeLabel: string;
  title: string;
  detail: string;
  tone: CommandCenterActivityTone;
  at: string;
};

export type CommandCenterPipeline = {
  critical: ExecutiveRecommendationView[];
  high: ExecutiveRecommendationView[];
  medium: ExecutiveRecommendationView[];
  low: ExecutiveRecommendationView[];
};

export type CommandCenterCharts = {
  revenueTrend: ExecutiveChartPoint[];
  revenueVsRefunds: Array<{ label: string; revenue: number; refunds: number }>;
  topProducts: ExecutiveChartPoint[];
  bottomProducts: ExecutiveChartPoint[];
  healthScoreHistory: ExecutiveChartPoint[];
  recommendationCategories: ExecutiveChartPoint[];
  inventoryAge: ExecutiveChartPoint[];
  recommendationStatus: ExecutiveChartPoint[];
  revenueOpportunityFunnel: ExecutiveChartPoint[];
  storeHealthBreakdown: ExecutiveChartPoint[];
};

export type CommandCenterHeader = {
  merchantName: string;
  greeting: string;
  storeHealth: number;
  criticalIssues: number;
  opportunities: number;
  potentialRevenue: number;
};

export type CommandCenterInventoryIntelligence = {
  inventoryHealth: number;
  openRecommendations: number;
  stockoutAlerts: number;
  deadStockAlerts: number;
  recentExecutions: number;
  capitalLocked: number;
  averageWeeksOfCover: number | null;
  fastMovers: number;
  slowMovers: number;
  inventoryAlerts: ExecutiveChartPoint[];
  recommendationGroups: ExecutiveChartPoint[];
  opportunityPipeline: ExecutiveChartPoint[];
  inventoryTrend: ExecutiveChartPoint[];
};

export type CommandCenterBundleDiscovery = {
  bundleHealth: number;
  openRecommendations: number;
  topOpportunities: number;
  potentialInventoryReduction: number;
  potentialAttachRate: number;
  recentExecutions: number;
  recommendationGroups: ExecutiveChartPoint[];
};

export type CommandCenterStoreAudit = {
  overallAuditScore: number;
  storeHealth: number;
  homepageScore: number;
  seoScore: number;
  accessibilityScore: number;
  performanceScore: number;
  conversionScore: number;
  mobileScore: number;
  themeScore: number;
  openRecommendations: number;
  criticalIssues: number;
  recentExecutions: number;
  recommendationGroups: ExecutiveChartPoint[];
  issueDistribution: ExecutiveChartPoint[];
  topFixes: ExecutiveChartPoint[];
  quickWins: ExecutiveChartPoint[];
  criticalIssueFeed: Array<{ id: string; title: string; category: string }>;
  healthTrend: ExecutiveChartPoint[];
  categoryBreakdown: ExecutiveChartPoint[];
  seoWidgets: ExecutiveChartPoint[];
  accessibilityWidgets: ExecutiveChartPoint[];
  performanceWidgets: ExecutiveChartPoint[];
  auditTimeline: ExecutiveChartPoint[];
  opportunityPipeline: ExecutiveChartPoint[];
};

export type CommandCenterTrendIntelligence = {
  trendHealth: number;
  trendDirection: string;
  openRecommendations: number;
  emergingCount: number;
  decliningCount: number;
  recentExecutions: number;
  growthAlerts: number;
  declineAlerts: number;
  recommendationGroups: ExecutiveChartPoint[];
  momentumCharts: ExecutiveChartPoint[];
  emergingOpportunities: ExecutiveChartPoint[];
  categoryOpportunities: ExecutiveChartPoint[];
  trendTimeline: ExecutiveChartPoint[];
  opportunityPipeline: ExecutiveChartPoint[];
};

export type CommandCenterSeoIntelligence = {
  seoHealth: number;
  organicOpportunity: number;
  searchVisibility: number;
  coreWebVitals: number;
  technicalSeo: number;
  contentQuality: number;
  openRecommendations: number;
  criticalIssues: number;
  recentExecutions: number;
  recommendationGroups: ExecutiveChartPoint[];
  seoTimeline: ExecutiveChartPoint[];
  organicGrowth: ExecutiveChartPoint[];
  criticalSeoFeed: Array<{ id: string; title: string; category: string }>;
  quickWins: ExecutiveChartPoint[];
  trendHistory: ExecutiveChartPoint[];
  issueDistribution: ExecutiveChartPoint[];
  opportunityPipeline: ExecutiveChartPoint[];
};

export type CommandCenterPricingIntelligence = {
  pricingHealth: number;
  marginPercent: number;
  profitOpportunity: number;
  revenueOpportunity: number;
  openRecommendations: number;
  criticalPricingRisks: number;
  recentExecutions: number;
  recommendationGroups: ExecutiveChartPoint[];
  pricingTimeline: ExecutiveChartPoint[];
  marginTrend: ExecutiveChartPoint[];
  criticalPricingFeed: Array<{ id: string; title: string; category: string }>;
  opportunityPipeline: ExecutiveChartPoint[];
};

export type CommandCenterGrowthIntelligence = {
  growthScore: number;
  monthlyRevenueOpportunity: number;
  aovOpportunity: number;
  repeatPurchaseOpportunity: number;
  expansionReadiness: number;
  openRecommendations: number;
  criticalGrowthRisks: number;
  recentExecutions: number;
  recommendationGroups: ExecutiveChartPoint[];
  campaignTimeline: ExecutiveChartPoint[];
  growthTrend: ExecutiveChartPoint[];
  criticalGrowthFeed: Array<{ id: string; title: string; category: string }>;
  opportunityPipeline: ExecutiveChartPoint[];
};

export type CommandCenterExecutiveCoo = {
  todaysPriority: string | null;
  businessHealth: number;
  executiveConfidence: number;
  merchantCapacity: number;
  businessMomentum: number;
  criticalPathLength: number;
  openPriorities: number;
  blockedTasks: number;
  recentExecutions: number;
  focusAreaGroups: ExecutiveChartPoint[];
  executionTimeline: ExecutiveChartPoint[];
  criticalPriorityFeed: Array<{ id: string; title: string; category: string }>;
  opportunityPipeline: ExecutiveChartPoint[];
  businessHealthTrend: ExecutiveChartPoint[];
  capacityUsage: ExecutiveChartPoint[];
  blockedTasksChart: ExecutiveChartPoint[];
};

export type CommandCenterExecutiveDecisions = {
  topDecision: string | null;
  consensusScore: number;
  conflictCount: number;
  dependencyCount: number;
  topRisk: string | null;
  topOpportunity: string | null;
  decisions: Array<{
    id: string;
    title: string;
    summary: string;
    agentsInvolved: string[];
    priority: number;
    confidence: number;
    hasConflict: boolean;
    hasDependency: boolean;
    estimatedRevenueImpact: number;
  }>;
  charts: {
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
};

export type CommandCenterData = {
  header: CommandCenterHeader;
  briefing: CommandCenterBriefing;
  activityFeed: CommandCenterActivityItem[];
  agents: CommandCenterAgentCard[];
  executive: ExecutiveDashboardData;
  inventoryIntelligence: CommandCenterInventoryIntelligence;
  bundleDiscovery: CommandCenterBundleDiscovery;
  storeAudit: CommandCenterStoreAudit;
  trendIntelligence: CommandCenterTrendIntelligence;
  seoIntelligence: CommandCenterSeoIntelligence;
  pricingIntelligence: CommandCenterPricingIntelligence;
  growthIntelligence: CommandCenterGrowthIntelligence;
  executiveCoo: CommandCenterExecutiveCoo;
  executiveDecisions: CommandCenterExecutiveDecisions;
  healthRing: CommandCenterHealthRing;
  pipeline: CommandCenterPipeline;
  charts: CommandCenterCharts;
  aiTimeline: CommandCenterTimelineItem[];
  costWidget: CommandCenterCostWidget;
  currency: string;
};
