import prisma from "../db.server";
import { getOrComputeCached, TimedCache } from "../lib/timed-cache.server";
import { loadLatestCollaborationOutputFromStore } from "./collaboration.server";
import { buildCollaborationChartData } from "../ai/collaboration/collaboration-timeline";
import type { CollaborationOutput } from "../ai/collaboration/collaboration-types";
import {
  calculateStoreHealthScore,
  serializeHealthScoreForLoader,
  type StoreHealthScore,
} from "./health-score.server";
import {
  formatCurrency,
  getStoreMetrics,
  serializeMetricsForLoader,
  type StoreMetrics,
} from "./metrics.server";

export * from "./executive-dashboard.types";
import {
  EXECUTIVE_RECOMMENDATION_GROUPS,
} from "./executive-dashboard.types";
import type {
  ExecutiveChartPoint,
  ExecutiveCollaborationCharts,
  ExecutiveCollaborationSummary,
  ExecutiveCooPanel,
  ExecutiveDashboardData,
  ExecutiveDecisionView,
  ExecutiveEstimatedImpact,
  ExecutiveGrowthIntelligencePanel,
  ExecutivePricingIntelligencePanel,
  ExecutiveProductSpotlight,
  ExecutiveRecommendationGroup,
  ExecutiveRecommendationView,
  ExecutiveSeoIntelligencePanel,
  ExecutiveStoreAuditPanel,
  ExecutiveSummaryCards,
  ExecutiveBriefing,
  ExecutiveTask,
  ExecutiveTimelineEvent,
} from "./executive-dashboard.types";

function mapCollaborationToExecutiveViews(output: CollaborationOutput): {
  decisions: ExecutiveDecisionView[];
  summary: ExecutiveCollaborationSummary;
  charts: ExecutiveCollaborationCharts;
} {
  const conflictRecommendationIds = new Set(output.conflicts.flatMap((conflict) => conflict.recommendations));
  const dependencyRecommendationIds = new Set([
    ...output.dependencies.map((dependency) => dependency.recommendationId),
    ...output.dependencies.flatMap((dependency) => dependency.dependsOn),
  ]);
  const charts = buildCollaborationChartData(output);

  return {
    decisions: output.executiveActions.map((action) => ({
      id: action.id,
      title: action.title,
      summary: action.summary,
      reason: action.reason,
      agentsInvolved: action.agentsInvolved,
      supportingEvidence: action.supportingEvidence.map((item) => item.label),
      priority: action.priority,
      confidence: action.confidence,
      risk: action.risk,
      estimatedRevenueImpact: action.estimatedRevenueImpact,
      estimatedInventoryImpact: action.estimatedInventoryImpact,
      estimatedConversionImpact: action.estimatedConversionImpact,
      merchantActions: action.merchantActions,
      verificationCriteria: action.verificationCriteria,
      timeline: action.timeline,
      group: action.group,
      reinforced: action.reinforced,
      requiresManualReview: action.requiresManualReview,
      hasConflict: action.sourceRecommendationIds.some((id) => conflictRecommendationIds.has(id)),
      hasDependency: action.sourceRecommendationIds.some((id) => dependencyRecommendationIds.has(id)),
    })),
    summary: {
      summary: output.summary,
      overallHealth: output.overallHealth,
      overallConfidence: output.overallConfidence,
      overallPriority: output.overallPriority,
      consensusScore: output.consensusScore,
      topRisk: output.topRisk,
      topOpportunity: output.topOpportunity,
      expectedImpact: output.expectedImpact,
      conflictCount: output.conflicts.length,
      dependencyCount: output.dependencies.length,
    },
    charts: {
      consensusGauge: charts.consensusGauge,
      agentInfluenceRadar: charts.agentInfluenceRadar,
      dependencyGraph: charts.dependencyGraph,
      priorityMatrixImpact: charts.priorityMatrix.map((item) => ({
        label: item.label,
        value: item.impact,
      })),
      priorityMatrixEffort: charts.priorityMatrix.map((item) => ({
        label: item.label,
        value: item.effort,
      })),
      conflictHeatmap: charts.conflictHeatmap,
      recommendationSankey: charts.recommendationSankey,
      decisionTimeline: charts.decisionTimeline,
      roiWaterfall: charts.roiWaterfall,
      healthWheel: charts.healthWheel,
      confidenceDistribution: charts.confidenceDistribution,
    },
  };
}

function buildEmptyCollaborationCharts(): ExecutiveCollaborationCharts {
  return {
    consensusGauge: [],
    agentInfluenceRadar: [],
    dependencyGraph: [],
    priorityMatrixImpact: [],
    priorityMatrixEffort: [],
    conflictHeatmap: [],
    recommendationSankey: [],
    decisionTimeline: [],
    roiWaterfall: [],
    healthWheel: [],
    confidenceDistribution: [],
  };
}

function decimalToNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseProductId(subjectKey: string): string | null {
  const match = subjectKey.match(/^product:(.+)$/);
  return match?.[1] ?? null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((entry) => String(entry)).filter(Boolean);
}

function parseEstimatedImpact(payload: Record<string, unknown>): ExecutiveEstimatedImpact {
  const impact = (payload.estimatedImpact as Record<string, unknown> | undefined) ?? {};

  return {
    revenueRecovered: impact.revenueRecovered == null ? null : decimalToNumber(impact.revenueRecovered),
    revenueOpportunity:
      impact.revenueOpportunity == null ? null : decimalToNumber(impact.revenueOpportunity),
    ordersProtected: impact.ordersProtected == null ? null : decimalToNumber(impact.ordersProtected),
    inventoryDaysSaved:
      impact.inventoryDaysSaved == null ? null : decimalToNumber(impact.inventoryDaysSaved),
    inventoryCostSaved:
      impact.inventoryCostSaved == null ? null : decimalToNumber(impact.inventoryCostSaved),
    estimatedLostSales:
      impact.estimatedLostSales == null ? null : decimalToNumber(impact.estimatedLostSales),
    marginImprovement:
      impact.marginImprovement == null ? null : decimalToNumber(impact.marginImprovement),
  };
}

function sumImpact(impact: ExecutiveEstimatedImpact): number {
  return (
    (impact.revenueRecovered ?? 0) +
    (impact.revenueOpportunity ?? 0) +
    (impact.estimatedLostSales ?? 0) +
    (impact.marginImprovement ?? 0) +
    (impact.inventoryCostSaved ?? 0)
  );
}

function normalizeGroup(value: unknown): ExecutiveRecommendationGroup {
  const group = String(value ?? "Operational Improvements");
  if (EXECUTIVE_RECOMMENDATION_GROUPS.includes(group as ExecutiveRecommendationGroup)) {
    return group as ExecutiveRecommendationGroup;
  }

  return "Operational Improvements";
}

export function mapRecommendationRecord(record: {
  stableId: string;
  subjectKey: string;
  title: string;
  summary: string;
  category: string;
  priority: number;
  confidence: unknown;
  status: string;
  payloadJson: unknown;
  lastSeenAt: Date;
  updatedAt: Date;
  productTitle?: string | null;
}): ExecutiveRecommendationView {
  const payload = (record.payloadJson as Record<string, unknown> | null) ?? {};
  const estimatedImpact = parseEstimatedImpact(payload);

  return {
    stableId: record.stableId,
    id: String(payload.id ?? record.stableId),
    subjectKey: record.subjectKey,
    productId: parseProductId(record.subjectKey),
    productTitle: record.productTitle ?? null,
    title: record.title,
    reason: String(payload.reason ?? record.summary),
    category: record.category,
    group: normalizeGroup(payload.group),
    priority: record.priority,
    priorityScore: decimalToNumber(payload.priorityScore),
    confidence: decimalToNumber(payload.confidence ?? record.confidence),
    difficulty: String(payload.difficulty ?? payload.estimatedDifficulty ?? "Medium"),
    evidence: asStringArray(payload.evidence),
    estimatedImpact,
    merchantAction: asStringArray(payload.merchantAction),
    tasks: asStringArray(payload.tasks),
    timeline: Object.fromEntries(
      Object.entries((payload.timeline as Record<string, unknown> | undefined) ?? {}).map(
        ([key, value]) => [key, value == null ? null : String(value)],
      ),
    ),
    status: record.status,
    verification: (payload.verification as Record<string, unknown> | undefined) ?? {},
    expectedResult: String(payload.expectedResult ?? ""),
    potentialRisk: String(payload.potentialRisk ?? ""),
    estimatedTime: String(payload.estimatedTime ?? ""),
    businessImpact: String(payload.businessImpact ?? payload.expectedImpact ?? ""),
    lastSeenAt: record.lastSeenAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function buildGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) {
    return "Good morning.";
  }

  if (hour < 17) {
    return "Good afternoon.";
  }

  return "Good evening.";
}

function buildBriefing(input: {
  recommendations: ExecutiveRecommendationView[];
  metrics: StoreMetrics;
  storeHealth: number;
  currency: string;
}): ExecutiveBriefing {
  const openRecommendations = input.recommendations.filter((item) =>
    ["open", "viewed"].includes(item.status),
  );
  const criticalCount = openRecommendations.filter(
    (item) => item.group === "Critical Risks",
  ).length;
  const estimatedOpportunity = openRecommendations.reduce(
    (total, item) => total + sumImpact(item.estimatedImpact),
    0,
  );
  const sorted = [...openRecommendations].sort(
    (left, right) => left.priority - right.priority || right.priorityScore - left.priorityScore,
  );

  const summaryLines = [
    `Store health is ${input.storeHealth} / 100.`,
    input.metrics.orders > 0
      ? `Revenue baseline is ${formatCurrency(input.metrics.grossRevenue, input.currency)} across ${input.metrics.orders} orders.`
      : "Revenue data is still syncing.",
    criticalCount > 0
      ? `Inventory or revenue risk detected for ${criticalCount} priority area${criticalCount === 1 ? "" : "s"}.`
      : "No critical AI risks are open right now.",
    estimatedOpportunity > 0
      ? `Estimated opportunity: ${formatCurrency(estimatedOpportunity, input.currency)}.`
      : "Estimated opportunity will appear after Product Intelligence runs.",
  ];

  return {
    greeting: buildGreeting(),
    storeHealth: input.storeHealth,
    summaryLines,
    estimatedOpportunity,
    highestPriorities: sorted.slice(0, 3).map((item) => item.title),
  };
}

function buildSummaryCards(input: {
  metrics: StoreMetrics;
  storeHealthScore: StoreHealthScore;
  recommendations: ExecutiveRecommendationView[];
  aiConfidence: number;
}): ExecutiveSummaryCards {
  const openRecommendations = input.recommendations.filter((item) =>
    ["open", "viewed"].includes(item.status),
  );

  const revenueHealth = Math.max(
    0,
    Math.min(100, Math.round(input.storeHealthScore.ordersScore * 2.5)),
  );
  const inventoryHealth = Math.max(
    0,
    Math.min(100, Math.round(input.storeHealthScore.inventoryScore * (100 / 30))),
  );
  const growthScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        (input.metrics.orders > 0 ? 55 : 20) +
          (input.metrics.grossRevenue > 0 ? 25 : 0) +
          (input.metrics.activeProducts > 10 ? 20 : 10),
      ),
    ),
  );

  return {
    storeHealth: input.storeHealthScore.score,
    revenueHealth,
    inventoryHealth,
    growthScore,
    aiConfidence: input.aiConfidence,
    openRecommendations: openRecommendations.length,
    highPriorityTasks: openRecommendations.filter((item) => item.priority <= 2).length,
  };
}

function groupRecommendations(
  recommendations: ExecutiveRecommendationView[],
): Record<ExecutiveRecommendationGroup, ExecutiveRecommendationView[]> {
  return EXECUTIVE_RECOMMENDATION_GROUPS.reduce(
    (groups, group) => {
      groups[group] = recommendations
        .filter((item) => item.group === group && ["open", "viewed"].includes(item.status))
        .sort(
          (left, right) => left.priority - right.priority || right.priorityScore - left.priorityScore,
        );
      return groups;
    },
    {} as Record<ExecutiveRecommendationGroup, ExecutiveRecommendationView[]>,
  );
}

function buildTimeline(recommendations: ExecutiveRecommendationView[]): ExecutiveTimelineEvent[] {
  const events: ExecutiveTimelineEvent[] = [];

  for (const recommendation of recommendations) {
    const timeline = recommendation.timeline;
    const entries: Array<[ExecutiveTimelineEvent["type"], string | null | undefined, string]> = [
      ["detected", timeline.detected, "AI detected an issue"],
      ["viewed", timeline.viewed, "Merchant viewed recommendation"],
      ["implemented", timeline.implemented, "Merchant implemented recommendation"],
      ["verified", timeline.verified, "Metrics improved and recommendation verified"],
      ["closed", timeline.closed, "Recommendation closed"],
    ];

    for (const [type, at, message] of entries) {
      if (!at) {
        continue;
      }

      events.push({
        id: `${recommendation.stableId}:${type}`,
        stableId: recommendation.stableId,
        recommendationId: recommendation.id,
        title: recommendation.title,
        type,
        message,
        at,
      });
    }

    if (recommendation.status === "dismissed") {
      events.push({
        id: `${recommendation.stableId}:dismissed`,
        stableId: recommendation.stableId,
        recommendationId: recommendation.id,
        title: recommendation.title,
        type: "dismissed",
        message: "Merchant dismissed recommendation",
        at: recommendation.updatedAt,
      });
    }
  }

  return events.sort((left, right) => right.at.localeCompare(left.at)).slice(0, 20);
}

function buildTasks(recommendations: ExecutiveRecommendationView[]): ExecutiveTask[] {
  return recommendations
    .filter((item) => ["open", "viewed"].includes(item.status))
    .flatMap((recommendation) =>
      (recommendation.tasks.length > 0 ? recommendation.tasks : recommendation.merchantAction).map(
        (task, index) => ({
          id: `${recommendation.stableId}:${index}`,
          title: task,
          priority: recommendation.priority,
          estimatedImpact: sumImpact(recommendation.estimatedImpact),
          difficulty: recommendation.difficulty,
          relatedRecommendationId: recommendation.id,
          relatedRecommendationTitle: recommendation.title,
          stableId: recommendation.stableId,
          subjectKey: recommendation.subjectKey,
        }),
      ),
    )
    .sort((left, right) => left.priority - right.priority)
    .slice(0, 12);
}

async function buildAnalytics(storeId: string, recommendations: ExecutiveRecommendationView[]) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [ordersByDay, lineItems, aiResults, inventoryResults, bundleResults, storeAuditResults, trendResults, seoIntelligenceResults, pricingIntelligenceResults, products] = await Promise.all([
    prisma.order.groupBy({
      by: ["metricDate"],
      where: {
        storeId,
        isTest: false,
        cancelledAt: null,
        metricDate: { gte: thirtyDaysAgo },
      },
      _sum: { totalPriceAmount: true },
      orderBy: { metricDate: "asc" },
    }),
    prisma.orderLineItem.groupBy({
      by: ["shopifyVariantId", "title"],
      where: {
        storeId,
        order: {
          isTest: false,
          cancelledAt: null,
          metricDate: { gte: thirtyDaysAgo },
        },
      },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 10,
    }),
    prisma.aiAgentResult.findMany({
      where: {
        storeId,
        agentId: "product_intelligence",
        isSuccess: true,
      },
      orderBy: { createdAt: "asc" },
      take: 20,
      select: {
        createdAt: true,
        resultJson: true,
      },
    }),
    prisma.aiAgentResult.findMany({
      where: {
        storeId,
        agentId: "inventory_intelligence",
        isSuccess: true,
      },
      orderBy: { createdAt: "asc" },
      take: 20,
      select: {
        createdAt: true,
        resultJson: true,
      },
    }),
    prisma.aiAgentResult.findMany({
      where: {
        storeId,
        agentId: "bundle_discovery",
        isSuccess: true,
      },
      orderBy: { createdAt: "asc" },
      take: 20,
      select: {
        createdAt: true,
        resultJson: true,
      },
    }),
    prisma.aiAgentResult.findMany({
      where: {
        storeId,
        agentId: "store_audit",
        isSuccess: true,
      },
      orderBy: { createdAt: "asc" },
      take: 20,
      select: {
        createdAt: true,
        resultJson: true,
      },
    }),
    prisma.aiAgentResult.findMany({
      where: {
        storeId,
        agentId: "trend_intelligence",
        isSuccess: true,
      },
      orderBy: { createdAt: "asc" },
      take: 20,
      select: {
        createdAt: true,
        resultJson: true,
      },
    }),
    prisma.aiAgentResult.findMany({
      where: {
        storeId,
        agentId: "seo_audit",
        isSuccess: true,
      },
      orderBy: { createdAt: "asc" },
      take: 20,
      select: {
        createdAt: true,
        resultJson: true,
      },
    }),
    prisma.aiAgentResult.findMany({
      where: {
        storeId,
        agentId: "pricing_intelligence",
        isSuccess: true,
      },
      orderBy: { createdAt: "asc" },
      take: 20,
      select: {
        createdAt: true,
        resultJson: true,
      },
    }),
    prisma.product.findMany({
      where: { storeId, status: { not: "archived" } },
      select: {
        title: true,
        inventoryQuantity: true,
        price: true,
      },
      take: 100,
    }),
  ]);

  const revenueTrend = ordersByDay.slice(-14).map((entry) => ({
    label: entry.metricDate.toISOString().slice(5, 10),
    value: decimalToNumber(entry._sum.totalPriceAmount),
  }));

  const inventoryTrend = products.slice(0, 7).map((product, index) => ({
    label: `P${index + 1}`,
    value: product.inventoryQuantity ?? 0,
  }));

  const healthScoreHistory = aiResults.map((entry, index) => ({
    label: `Run ${index + 1}`,
    value: decimalToNumber((entry.resultJson as Record<string, unknown>).healthScore),
  }));

  const recommendationImpact = EXECUTIVE_RECOMMENDATION_GROUPS.map((group) => ({
    label: group.replace(" Opportunities", "").replace(" Risks", ""),
    value: recommendations
      .filter((item) => item.group === group)
      .reduce((total, item) => total + sumImpact(item.estimatedImpact), 0),
  }));

  const topProducts = lineItems.slice(0, 5).map((entry) => ({
    label: entry.title.slice(0, 18),
    value: entry._sum.quantity ?? 0,
  }));

  const bottomProducts = [...lineItems]
    .reverse()
    .slice(0, 5)
    .map((entry) => ({
      label: entry.title.slice(0, 18),
      value: entry._sum.quantity ?? 0,
    }));

  const velocityTrend = revenueTrend.map((point) => ({
    label: point.label,
    value: point.value > 0 ? Math.max(1, Math.round(point.value / 100)) : 0,
  }));

  const refundOrders = await prisma.order.groupBy({
    by: ["metricDate"],
    where: {
      storeId,
      metricDate: { gte: thirtyDaysAgo },
      totalRefundedAmount: { gt: 0 },
    },
    _sum: { totalRefundedAmount: true },
    orderBy: { metricDate: "asc" },
  });

  const refundTrend = refundOrders.slice(-14).map((entry) => ({
    label: entry.metricDate.toISOString().slice(5, 10),
    value: decimalToNumber(entry._sum.totalRefundedAmount),
  }));

  const inventoryAge = products
    .filter((product) => (product.inventoryQuantity ?? 0) > 20)
    .slice(0, 6)
    .map((product) => ({
      label: product.title.slice(0, 16),
      value: product.inventoryQuantity ?? 0,
    }));

  const healthBuckets = new Map<string, number>();
  for (const result of aiResults) {
    const score = decimalToNumber((result.resultJson as Record<string, unknown>).healthScore);
    const bucket =
      score >= 80 ? "Healthy" : score >= 60 ? "Watch" : score > 0 ? "At Risk" : "Unknown";
    healthBuckets.set(bucket, (healthBuckets.get(bucket) ?? 0) + 1);
  }

  const healthDistribution = [...healthBuckets.entries()].map(([label, value]) => ({
    label,
    value,
  }));

  const completed = recommendations.filter((item) =>
    ["implemented", "verified", "closed"].includes(item.status),
  ).length;
  const recommendationCompletionRate =
    recommendations.length > 0 ? Math.round((completed / recommendations.length) * 100) : 0;

  const inventoryHealthHistory = inventoryResults.map((entry, index) => ({
    label: `Run ${index + 1}`,
    value: decimalToNumber((entry.resultJson as Record<string, unknown>).inventoryHealthScore),
  }));

  const latestInventoryResult = inventoryResults[inventoryResults.length - 1]?.resultJson as
    | Record<string, unknown>
    | undefined;

  const deadStockCount = [
    {
      label: "Current",
      value: decimalToNumber(latestInventoryResult?.deadStockCount),
    },
  ];

  const stockCoverageTrend = inventoryResults.map((entry, index) => ({
    label: `Run ${index + 1}`,
    value: decimalToNumber((entry.resultJson as Record<string, unknown>).averageDaysRemaining),
  }));

  const reorderTimeline = (
    (latestInventoryResult?.reorderSuggestions as Array<{ title: string; urgency: number }> | undefined) ??
    []
  )
    .slice(0, 6)
    .map((item, _index) => ({
      label: item.title.slice(0, 14),
      value: item.urgency,
    }));

  if (reorderTimeline.length === 0) {
    reorderTimeline.push({ label: "None", value: 0 });
  }

  const inventoryRiskDistribution = [
    {
      label: "Stockout",
      value: decimalToNumber(latestInventoryResult?.stockoutAlertCount),
    },
    {
      label: "Dead Stock",
      value: decimalToNumber(latestInventoryResult?.deadStockCount),
    },
    {
      label: "Overstock",
      value: decimalToNumber(latestInventoryResult?.overstockCount),
    },
    {
      label: "Understock",
      value: decimalToNumber(latestInventoryResult?.understockCount),
    },
  ];

  const latestBundleResult = bundleResults[bundleResults.length - 1]?.resultJson as
    | Record<string, unknown>
    | undefined;

  const topBundleOpportunities = (
    (latestBundleResult?.bundleCandidates as Array<{ titles?: string[]; confidence?: number }> | undefined) ??
    []
  )
    .slice(0, 5)
    .map((candidate, index) => ({
      label: candidate.titles?.join(" + ").slice(0, 18) ?? `Bundle ${index + 1}`,
      value: decimalToNumber(candidate.confidence) * 100,
    }));

  if (topBundleOpportunities.length === 0) {
    topBundleOpportunities.push({ label: "None", value: 0 });
  }

  const bundleSuccessRate = [
    {
      label: "Current",
      value: Math.round(decimalToNumber(latestBundleResult?.bundleSuccessRate) * 100),
    },
  ];

  const potentialInventoryReduction = [
    {
      label: "Current",
      value: decimalToNumber(latestBundleResult?.potentialInventoryReduction),
    },
  ];

  const potentialAttachRate = [
    {
      label: "Current",
      value: Math.round(decimalToNumber(latestBundleResult?.potentialAttachRate) * 100),
    },
  ];

  const bundleHealth = bundleResults.map((entry, index) => ({
    label: `Run ${index + 1}`,
    value: decimalToNumber((entry.resultJson as Record<string, unknown>).bundleHealthScore),
  }));

  const abcDistribution = (
    (latestInventoryResult?.abcDistribution as Array<{ label: string; value: number }> | undefined) ??
    [
      { label: "A", value: 0 },
      { label: "B", value: 0 },
      { label: "C", value: 0 },
    ]
  ).map((entry) => ({
    label: entry.label,
    value: decimalToNumber(entry.value),
  }));

  const weeksOfCover = [
    {
      label: "Average",
      value: decimalToNumber(latestInventoryResult?.averageWeeksOfCover),
    },
    ...(
      (latestInventoryResult?.products as Array<{ title: string; weeksOfCover?: number }> | undefined) ??
      []
    )
      .slice(0, 5)
      .map((product) => ({
        label: product.title.slice(0, 14),
        value: decimalToNumber(product.weeksOfCover),
      })),
  ];

  const capitalLocked = [
    {
      label: "Current",
      value: decimalToNumber(latestInventoryResult?.capitalLockedInInventory),
    },
    ...inventoryResults.slice(-5).map((entry, index) => ({
      label: `Run ${inventoryResults.length - 5 + index + 1}`,
      value: decimalToNumber(
        (entry.resultJson as Record<string, unknown>).capitalLockedInInventory,
      ),
    })),
  ].filter((entry) => entry.value > 0 || entry.label === "Current");

  if (capitalLocked.length === 0) {
    capitalLocked.push({ label: "Current", value: 0 });
  }

  const inventoryTimeline = inventoryResults.map((entry, _index) => ({
    label: new Date(entry.createdAt).toISOString().slice(5, 10),
    value: decimalToNumber((entry.resultJson as Record<string, unknown>).inventoryHealthScore),
  }));

  const latestStoreAuditResult = storeAuditResults[storeAuditResults.length - 1]?.resultJson as
    | Record<string, unknown>
    | undefined;

  const storeAuditHealth = storeAuditResults.map((entry, index) => ({
    label: `Run ${index + 1}`,
    value: decimalToNumber((entry.resultJson as Record<string, unknown>).storeHealthScore),
  }));

  const homepageScore = storeAuditResults.map((entry, index) => ({
    label: `Run ${index + 1}`,
    value: decimalToNumber((entry.resultJson as Record<string, unknown>).homepageScore),
  }));

  const seoScoreHistory = storeAuditResults.map((entry, index) => ({
    label: `Run ${index + 1}`,
    value: decimalToNumber((entry.resultJson as Record<string, unknown>).seoScore),
  }));

  const accessibilityScoreHistory = storeAuditResults.map((entry, index) => ({
    label: `Run ${index + 1}`,
    value: decimalToNumber((entry.resultJson as Record<string, unknown>).accessibilityScore),
  }));

  const performanceScoreHistory = storeAuditResults.map((entry, index) => ({
    label: `Run ${index + 1}`,
    value: decimalToNumber((entry.resultJson as Record<string, unknown>).performanceScore),
  }));

  const themeScoreHistory = storeAuditResults.map((entry, index) => ({
    label: `Run ${index + 1}`,
    value: decimalToNumber((entry.resultJson as Record<string, unknown>).themeScore),
  }));

  const conversionScoreHistory = storeAuditResults.map((entry, index) => ({
    label: `Run ${index + 1}`,
    value: decimalToNumber((entry.resultJson as Record<string, unknown>).conversionScore),
  }));

  const mobileScoreHistory = storeAuditResults.map((entry, index) => ({
    label: `Run ${index + 1}`,
    value: decimalToNumber((entry.resultJson as Record<string, unknown>).mobileScore),
  }));

  const storeAuditIssueDistribution = [
    { label: "Homepage", value: decimalToNumber(latestStoreAuditResult?.homepageScore) < 70 ? 1 : 0 },
    { label: "SEO", value: decimalToNumber(latestStoreAuditResult?.seoScore) < 70 ? 1 : 0 },
    {
      label: "Performance",
      value: decimalToNumber(latestStoreAuditResult?.performanceScore) < 70 ? 1 : 0,
    },
    {
      label: "Accessibility",
      value: decimalToNumber(latestStoreAuditResult?.accessibilityScore) < 70 ? 1 : 0,
    },
    {
      label: "Conversion",
      value: decimalToNumber(latestStoreAuditResult?.conversionScore) < 70 ? 1 : 0,
    },
    { label: "Mobile", value: decimalToNumber(latestStoreAuditResult?.mobileScore) < 70 ? 1 : 0 },
  ];

  const storeAuditRecommendationTrend = storeAuditResults.map((entry, _index) => ({
    label: new Date(entry.createdAt).toISOString().slice(5, 10),
    value: Array.isArray((entry.resultJson as Record<string, unknown>).recommendations)
      ? ((entry.resultJson as Record<string, unknown>).recommendations as unknown[]).length
      : 0,
  }));

  if (storeAuditHealth.length === 0) {
    storeAuditHealth.push({ label: "Current", value: 0 });
  }

  const latestTrendResult = trendResults[trendResults.length - 1]?.resultJson as
    | Record<string, unknown>
    | undefined;

  const trendHealth = trendResults.map((entry, index) => ({
    label: `Run ${index + 1}`,
    value: decimalToNumber((entry.resultJson as Record<string, unknown>).trendHealthScore),
  }));

  const emergingProductsTrend = (
    (latestTrendResult?.emergingProducts as Array<{ title?: string; momentum?: number }> | undefined) ??
    []
  )
    .slice(0, 5)
    .map((product, index) => ({
      label: product.title?.slice(0, 18) ?? `Emerging ${index + 1}`,
      value: decimalToNumber(product.momentum) * 100,
    }));

  if (emergingProductsTrend.length === 0) {
    emergingProductsTrend.push({ label: "None", value: 0 });
  }

  const decliningProductsTrend = (
    (latestTrendResult?.decliningProducts as Array<{ title?: string; sales30Days?: number }> | undefined) ??
    []
  )
    .slice(0, 5)
    .map((product, index) => ({
      label: product.title?.slice(0, 18) ?? `Declining ${index + 1}`,
      value: decimalToNumber(product.sales30Days),
    }));

  if (decliningProductsTrend.length === 0) {
    decliningProductsTrend.push({ label: "None", value: 0 });
  }

  const momentumTrend = [
    {
      label: "Emerging",
      value: Array.isArray(latestTrendResult?.emergingProducts)
        ? (latestTrendResult?.emergingProducts as unknown[]).length
        : 0,
    },
    {
      label: "Declining",
      value: Array.isArray(latestTrendResult?.decliningProducts)
        ? (latestTrendResult?.decliningProducts as unknown[]).length
        : 0,
    },
  ];

  const growthVsDeclineTrend = [
    { label: "Growth", value: momentumTrend[0]?.value ?? 0 },
    { label: "Decline", value: momentumTrend[1]?.value ?? 0 },
  ];

  const trendRevenueTrend = trendResults.map((entry, index) => ({
    label: `Run ${index + 1}`,
    value: decimalToNumber((entry.resultJson as Record<string, unknown>).trendHealthScore),
  }));

  const trendVelocityTrend = emergingProductsTrend;

  const seasonalityTrend = (
    (latestTrendResult?.seasonalSignals as Array<{ label?: string; strength?: number }> | undefined) ??
    []
  ).map((signal, index) => ({
    label: signal.label?.slice(0, 16) ?? `Signal ${index + 1}`,
    value: decimalToNumber(signal.strength) * 100,
  }));

  if (seasonalityTrend.length === 0) {
    seasonalityTrend.push({ label: "None", value: 0 });
  }

  const categoryTrendChart = emergingProductsTrend;

  const trendTimeline = trendResults.map((entry, _index) => ({
    label: new Date(entry.createdAt).toISOString().slice(5, 10),
    value: decimalToNumber((entry.resultJson as Record<string, unknown>).trendHealthScore),
  }));

  if (trendHealth.length === 0) {
    trendHealth.push({ label: "Current", value: 0 });
  }

  const latestSeoResult = seoIntelligenceResults[seoIntelligenceResults.length - 1]?.resultJson as
    | Record<string, unknown>
    | undefined;

  const seoIntelligenceHealthHistory = seoIntelligenceResults.map((entry, index) => ({
    label: `Run ${index + 1}`,
    value: decimalToNumber((entry.resultJson as Record<string, unknown>).seoHealthScore),
  }));

  const seoVisibilityTrend = seoIntelligenceResults.map((entry, index) => ({
    label: `Run ${index + 1}`,
    value: decimalToNumber((entry.resultJson as Record<string, unknown>).visibilityOpportunity),
  }));

  const seoCtrTrend = seoIntelligenceResults.map((entry, index) => ({
    label: `Run ${index + 1}`,
    value: decimalToNumber((entry.resultJson as Record<string, unknown>).trafficOpportunity),
  }));

  const seoOrganicOpportunity = seoIntelligenceResults.map((entry, index) => ({
    label: `Run ${index + 1}`,
    value: decimalToNumber(
      (entry.resultJson as Record<string, unknown>).scores &&
        typeof (entry.resultJson as Record<string, unknown>).scores === "object"
        ? ((entry.resultJson as Record<string, unknown>).scores as Record<string, unknown>)
            .organicOpportunityScore
        : (entry.resultJson as Record<string, unknown>).organicOpportunityScore,
    ),
  }));

  const seoCoreWebVitalsTrend = seoIntelligenceResults.map((entry, index) => ({
    label: `Run ${index + 1}`,
    value: decimalToNumber(
      ((entry.resultJson as Record<string, unknown>).scores as Record<string, unknown> | undefined)
        ?.coreWebVitalsScore,
    ),
  }));

  const seoTechnicalRadar = [
    {
      label: "Technical",
      value: decimalToNumber(
        ((latestSeoResult?.scores as Record<string, unknown> | undefined)?.technicalSeoScore),
      ),
    },
    {
      label: "Content",
      value: decimalToNumber(((latestSeoResult?.scores as Record<string, unknown> | undefined)?.contentScore)),
    },
    {
      label: "Indexability",
      value: decimalToNumber(
        ((latestSeoResult?.scores as Record<string, unknown> | undefined)?.indexabilityScore),
      ),
    },
    {
      label: "Structured Data",
      value: decimalToNumber(
        ((latestSeoResult?.scores as Record<string, unknown> | undefined)?.structuredDataScore),
      ),
    },
    {
      label: "Internal Links",
      value: decimalToNumber(
        ((latestSeoResult?.scores as Record<string, unknown> | undefined)?.internalLinkingScore),
      ),
    },
  ];

  const seoIssueDistribution = (
    (latestSeoResult?.technicalFindings as Array<{ category?: string }> | undefined) ?? []
  ).reduce<ExecutiveChartPoint[]>((acc, finding) => {
    const label = String(finding.category ?? "Technical SEO");
    const existing = acc.find((entry) => entry.label === label);
    if (existing) existing.value += 1;
    else acc.push({ label, value: 1 });
    return acc;
  }, []);

  if (seoIssueDistribution.length === 0) {
    seoIssueDistribution.push({ label: "Metadata", value: 1 });
  }

  const seoKeywordDistribution = [
    { label: "Branded", value: decimalToNumber(latestSeoResult?.visibilityOpportunity) / 10 },
    { label: "Non-branded", value: decimalToNumber(latestSeoResult?.trafficOpportunity) / 10 },
  ];

  const seoPositionTrend = seoIntelligenceResults.map((entry, index) => ({
    label: `Run ${index + 1}`,
    value: decimalToNumber(
      ((entry.resultJson as Record<string, unknown>).scores as Record<string, unknown> | undefined)
        ?.searchVisibilityScore,
    ),
  }));

  const seoIndexCoverage = seoIntelligenceResults.map((entry, index) => ({
    label: `Run ${index + 1}`,
    value: decimalToNumber(
      ((entry.resultJson as Record<string, unknown>).scores as Record<string, unknown> | undefined)
        ?.indexabilityScore,
    ),
  }));

  const seoContentQuality = seoIntelligenceResults.map((entry, index) => ({
    label: `Run ${index + 1}`,
    value: decimalToNumber(
      ((entry.resultJson as Record<string, unknown>).scores as Record<string, unknown> | undefined)?.contentScore,
    ),
  }));

  const seoHealthTimeline = seoIntelligenceResults.map((entry) => ({
    label: new Date(entry.createdAt).toISOString().slice(5, 10),
    value: decimalToNumber((entry.resultJson as Record<string, unknown>).seoHealthScore),
  }));

  if (seoIntelligenceHealthHistory.length === 0) {
    seoIntelligenceHealthHistory.push({ label: "Current", value: 0 });
  }

  const latestPricingResult = pricingIntelligenceResults[pricingIntelligenceResults.length - 1]?.resultJson as
    | Record<string, unknown>
    | undefined;
  const pricingScores = (latestPricingResult?.scores as Record<string, unknown> | undefined) ?? {};

  const pricingHealthHistory = pricingIntelligenceResults.map((entry, index) => ({
    label: `Run ${index + 1}`,
    value: decimalToNumber((entry.resultJson as Record<string, unknown>).pricingHealthScore),
  }));
  const marginTrend = pricingIntelligenceResults.map((entry, index) => ({
    label: `Run ${index + 1}`,
    value: decimalToNumber(
      ((entry.resultJson as Record<string, unknown>).scores as Record<string, unknown> | undefined)?.marginPercent,
    ),
  }));
  const revenueVsProfit = pricingIntelligenceResults.map((entry, index) => ({
    label: `Run ${index + 1}`,
    value: decimalToNumber(
      ((entry.resultJson as Record<string, unknown>).scores as Record<string, unknown> | undefined)?.grossProfit,
    ),
  }));
  const discountTrend = pricingIntelligenceResults.map((entry, index) => ({
    label: `Run ${index + 1}`,
    value: decimalToNumber(
      ((entry.resultJson as Record<string, unknown>).scores as Record<string, unknown> | undefined)
        ?.averageDiscountPercent,
    ),
  }));
  const priceDistribution = products.slice(0, 8).map((product, index) => ({
    label: `P${index + 1}`,
    value: decimalToNumber(product.price),
  }));
  const pricingRisk = [
    { label: "Revenue", value: decimalToNumber(pricingScores.revenueRisk) },
    { label: "Profit", value: decimalToNumber(pricingScores.profitRisk) },
    { label: "Inventory", value: decimalToNumber(pricingScores.inventoryRisk) },
  ];
  const pricingOpportunityFunnel = [
    { label: "Revenue", value: decimalToNumber(latestPricingResult?.revenueOpportunity) },
    { label: "Profit", value: decimalToNumber(latestPricingResult?.profitOpportunity) },
    { label: "Premium", value: decimalToNumber(pricingScores.premiumPricingOpportunity) },
  ];
  const marginDistribution = [
    { label: "Low", value: decimalToNumber(pricingScores.marginPercent) < 30 ? 1 : 0 },
    { label: "Healthy", value: decimalToNumber(pricingScores.marginPercent) >= 30 ? 1 : 0 },
  ];
  const discountDependenceTrend = pricingIntelligenceResults.map((entry, index) => ({
    label: `Run ${index + 1}`,
    value: decimalToNumber(
      ((entry.resultJson as Record<string, unknown>).scores as Record<string, unknown> | undefined)
        ?.discountDependence,
    ),
  }));
  const pricingTimeline = pricingIntelligenceResults.map((entry) => ({
    label: new Date(entry.createdAt).toISOString().slice(5, 10),
    value: decimalToNumber((entry.resultJson as Record<string, unknown>).pricingHealthScore),
  }));

  if (pricingHealthHistory.length === 0) {
    pricingHealthHistory.push({ label: "Current", value: 0 });
  }

  return {
    revenueTrend,
    inventoryTrend,
    healthScoreHistory,
    recommendationImpact,
    topProducts,
    bottomProducts,
    velocityTrend,
    refundTrend,
    inventoryAge,
    healthDistribution,
    recommendationCompletionRate,
    inventoryHealthHistory,
    deadStockCount,
    stockCoverageTrend,
    reorderTimeline,
    inventoryRiskDistribution,
    topBundleOpportunities,
    bundleSuccessRate,
    potentialInventoryReduction,
    potentialAttachRate,
    bundleHealth,
    abcDistribution,
    weeksOfCover,
    capitalLocked,
    inventoryTimeline,
    storeAuditHealth,
    homepageScore,
    seoScoreHistory,
    accessibilityScoreHistory,
    performanceScoreHistory,
    themeScoreHistory,
    conversionScoreHistory,
    mobileScoreHistory,
    storeAuditIssueDistribution,
    storeAuditRecommendationTrend,
    trendHealth,
    emergingProductsTrend,
    decliningProductsTrend,
    momentumTrend,
    growthVsDeclineTrend,
    trendRevenueTrend,
    trendVelocityTrend,
    seasonalityTrend,
    categoryTrendChart,
    trendTimeline,
    seoIntelligenceHealthHistory,
    seoVisibilityTrend,
    seoCtrTrend,
    seoOrganicOpportunity,
    seoCoreWebVitalsTrend,
    seoTechnicalRadar,
    seoIssueDistribution,
    seoKeywordDistribution,
    seoPositionTrend,
    seoIndexCoverage,
    seoContentQuality,
    seoHealthTimeline,
    pricingHealthHistory,
    marginTrend,
    revenueVsProfit,
    discountTrend,
    priceDistribution,
    pricingRisk,
    pricingOpportunityFunnel,
    marginDistribution,
    discountDependenceTrend,
    pricingTimeline,
  };
}

export function buildSeoIntelligencePanel(input: {
  seoIntelligenceResults: Array<{ resultJson: unknown }>;
  seoRecommendations: ExecutiveRecommendationView[];
}): ExecutiveSeoIntelligencePanel {
  const latest = input.seoIntelligenceResults[input.seoIntelligenceResults.length - 1]?.resultJson as
    | Record<string, unknown>
    | undefined;
  const scores = (latest?.scores as Record<string, unknown> | undefined) ?? {};
  const seoHistory = input.seoIntelligenceResults.map((entry, index) => ({
    label: `Run ${index + 1}`,
    value: decimalToNumber((entry.resultJson as Record<string, unknown>).seoHealthScore),
  }));
  const quickWinTitles = input.seoRecommendations
    .filter((item) => item.group === "Quick Wins" && ["open", "viewed"].includes(item.status))
    .slice(0, 5)
    .map((item, index) => ({
      label: item.title.slice(0, 18),
      value: 5 - index,
    }));

  return {
    seoHealth: decimalToNumber(latest?.seoHealthScore),
    seoTrend: seoHistory.length > 0 ? seoHistory : [{ label: "Current", value: 0 }],
    organicOpportunity: decimalToNumber(scores.organicOpportunityScore ?? latest?.trafficOpportunity),
    searchVisibility: decimalToNumber(scores.searchVisibilityScore),
    coreWebVitals: decimalToNumber(scores.coreWebVitalsScore),
    technicalSeo: decimalToNumber(scores.technicalSeoScore),
    contentQuality: decimalToNumber(scores.contentScore),
    indexCoverage: decimalToNumber(scores.indexabilityScore),
    structuredData: decimalToNumber(scores.structuredDataScore),
    quickWins: quickWinTitles.length > 0 ? quickWinTitles : [{ label: "None", value: 0 }],
    opportunityTimeline: Array.isArray(latest?.seoTimeline)
      ? (latest?.seoTimeline as ExecutiveChartPoint[])
      : [
          { label: "SEO Health", value: decimalToNumber(latest?.seoHealthScore) },
          { label: "Traffic", value: decimalToNumber(latest?.trafficOpportunity) },
          { label: "Visibility", value: decimalToNumber(latest?.visibilityOpportunity) },
        ],
    seoHistory: seoHistory.length > 0 ? seoHistory : [{ label: "Current", value: 0 }],
  };
}

export function buildPricingIntelligencePanel(input: {
  pricingIntelligenceResults: Array<{ resultJson: unknown }>;
  pricingRecommendations: ExecutiveRecommendationView[];
}): ExecutivePricingIntelligencePanel {
  const latest = input.pricingIntelligenceResults[input.pricingIntelligenceResults.length - 1]?.resultJson as
    | Record<string, unknown>
    | undefined;
  const scores = (latest?.scores as Record<string, unknown> | undefined) ?? {};
  const pricingHealthTrend = input.pricingIntelligenceResults.map((entry, index) => ({
    label: `Run ${index + 1}`,
    value: decimalToNumber((entry.resultJson as Record<string, unknown>).pricingHealthScore),
  }));
  const criticalPricingRisks = input.pricingRecommendations
    .filter((item) => item.priority === 1 && ["open", "viewed"].includes(item.status))
    .slice(0, 5)
    .map((item, index) => ({
      label: item.title.slice(0, 18),
      value: 5 - index,
    }));

  return {
    pricingHealth: decimalToNumber(latest?.pricingHealthScore),
    marginPercent: decimalToNumber(scores.marginPercent),
    profitOpportunity: decimalToNumber(latest?.profitOpportunity),
    revenueOpportunity: decimalToNumber(latest?.revenueOpportunity),
    averageDiscountPercent: decimalToNumber(scores.averageDiscountPercent),
    discountDependence: decimalToNumber(scores.discountDependence),
    pricingHealthTrend: pricingHealthTrend.length > 0 ? pricingHealthTrend : [{ label: "Current", value: 0 }],
    marginTrend: pricingHealthTrend.map((entry, index) => ({
      label: entry.label,
      value: decimalToNumber(
        ((input.pricingIntelligenceResults[index]?.resultJson as Record<string, unknown> | undefined)?.scores as
          | Record<string, unknown>
          | undefined)?.marginPercent,
      ),
    })),
    revenueVsProfit: [
      { label: "Revenue", value: decimalToNumber(scores.revenue) },
      { label: "Profit", value: decimalToNumber(scores.grossProfit) },
    ],
    discountTrend: pricingHealthTrend.map((entry, index) => ({
      label: entry.label,
      value: decimalToNumber(
        ((input.pricingIntelligenceResults[index]?.resultJson as Record<string, unknown> | undefined)?.scores as
          | Record<string, unknown>
          | undefined)?.averageDiscountPercent,
      ),
    })),
    priceDistribution: [
      { label: "Low", value: decimalToNumber(scores.pricePositionScore) < 50 ? 1 : 0 },
      { label: "Aligned", value: decimalToNumber(scores.pricePositionScore) >= 50 ? 1 : 0 },
    ],
    pricingRisk: [
      { label: "Revenue", value: decimalToNumber(scores.revenueRisk) },
      { label: "Profit", value: decimalToNumber(scores.profitRisk) },
      { label: "Inventory", value: decimalToNumber(scores.inventoryRisk) },
    ],
    opportunityFunnel: [
      { label: "Revenue", value: decimalToNumber(latest?.revenueOpportunity) },
      { label: "Profit", value: decimalToNumber(latest?.profitOpportunity) },
      { label: "Premium", value: decimalToNumber(scores.premiumPricingOpportunity) },
    ],
    marginDistribution: [
      { label: "Margin", value: decimalToNumber(scores.marginPercent) },
      { label: "Target", value: 40 },
    ],
    discountDependenceTrend: pricingHealthTrend.map((entry, index) => ({
      label: entry.label,
      value: decimalToNumber(
        ((input.pricingIntelligenceResults[index]?.resultJson as Record<string, unknown> | undefined)?.scores as
          | Record<string, unknown>
          | undefined)?.discountDependence,
      ),
    })),
    pricingTimeline: Array.isArray(latest?.pricingTimeline)
      ? (latest?.pricingTimeline as ExecutiveChartPoint[])
      : [
          { label: "Health", value: decimalToNumber(latest?.pricingHealthScore) },
          { label: "Revenue", value: decimalToNumber(latest?.revenueOpportunity) },
          { label: "Profit", value: decimalToNumber(latest?.profitOpportunity) },
        ],
    criticalPricingRisks:
      criticalPricingRisks.length > 0 ? criticalPricingRisks : [{ label: "None", value: 0 }],
  };
}

export function buildGrowthIntelligencePanel(input: {
  growthIntelligenceResults: Array<{ resultJson: unknown }>;
  growthRecommendations: ExecutiveRecommendationView[];
}): ExecutiveGrowthIntelligencePanel {
  const latest = input.growthIntelligenceResults[input.growthIntelligenceResults.length - 1]?.resultJson as
    | Record<string, unknown>
    | undefined;
  const growthHistory = input.growthIntelligenceResults.map((entry, index) => ({
    label: `Run ${index + 1}`,
    value: decimalToNumber((entry.resultJson as Record<string, unknown>).growthScore),
  }));
  const criticalGrowthRisks = input.growthRecommendations
    .filter((item) => item.priority === 1 && ["open", "viewed"].includes(item.status))
    .slice(0, 5)
    .map((item, index) => ({
      label: item.title.slice(0, 18),
      value: 5 - index,
    }));
  const groupCounts = new Map<string, number>();
  for (const recommendation of input.growthRecommendations.filter((item) =>
    ["open", "viewed"].includes(item.status),
  )) {
    groupCounts.set(recommendation.group, (groupCounts.get(recommendation.group) ?? 0) + 1);
  }

  const growthScore = decimalToNumber(latest?.growthScore ?? latest?.growthHealthScore);
  const monthlyRevenueOpportunity = decimalToNumber(latest?.revenueOpportunity);
  const aovOpportunity = decimalToNumber(latest?.aovOpportunity);

  return {
    growthScore,
    monthlyRevenueOpportunity,
    aovOpportunity,
    repeatPurchaseOpportunity: decimalToNumber(latest?.expectedProfitLift),
    expansionReadiness: decimalToNumber(latest?.growthHealthScore ?? growthScore),
    growthTrend: growthHistory.length > 0 ? growthHistory : [{ label: "Current", value: growthScore }],
    opportunityFunnel: [
      { label: "Revenue", value: monthlyRevenueOpportunity },
      { label: "AOV", value: aovOpportunity },
      { label: "Upsell", value: decimalToNumber(latest?.expectedRevenueLift) },
    ],
    growthCategories: [...groupCounts.entries()].map(([label, value]) => ({ label, value })),
    revenueLiftForecast: growthHistory.length > 0 ? growthHistory : [{ label: "Current", value: growthScore }],
    growthRoi: [{ label: "Current", value: growthScore }],
    campaignTimeline: Array.isArray(latest?.campaignTimeline)
      ? (latest.campaignTimeline as ExecutiveChartPoint[])
      : [
          { label: "Growth", value: growthScore },
          { label: "Revenue", value: monthlyRevenueOpportunity },
          { label: "AOV", value: aovOpportunity },
        ],
    collectionPerformance: [
      { label: "Collections", value: growthScore },
      { label: "Merchandising", value: decimalToNumber(latest?.growthHealthScore) },
    ],
    growthCapacity: [
      { label: "Capacity", value: growthScore },
      { label: "Campaign Ready", value: aovOpportunity },
    ],
    revenueSources: [
      { label: "Revenue 30d", value: monthlyRevenueOpportunity },
      { label: "Revenue 90d", value: decimalToNumber(latest?.expectedRevenueLift) },
    ],
    priorityDistribution: [...groupCounts.entries()].map(([label, value]) => ({ label, value })),
    criticalGrowthRisks:
      criticalGrowthRisks.length > 0 ? criticalGrowthRisks : [{ label: "None", value: 0 }],
  };
}

export function buildExecutiveCooPanel(input: {
  executiveCooResults: Array<{ resultJson: unknown }>;
  executiveRecommendations: ExecutiveRecommendationView[];
}): ExecutiveCooPanel {
  const latest = input.executiveCooResults[input.executiveCooResults.length - 1]?.resultJson as
    | Record<string, unknown>
    | undefined;
  const businessHealthHistory = input.executiveCooResults.map((entry, index) => ({
    label: `Run ${index + 1}`,
    value: decimalToNumber(
      (entry.resultJson as Record<string, unknown>).businessHealthScore ??
        (entry.resultJson as Record<string, unknown>).operationsHealthScore,
    ),
  }));
  const openRecommendations = input.executiveRecommendations.filter((item) =>
    ["open", "viewed"].includes(item.status),
  );
  const groupCounts = new Map<string, number>();
  for (const recommendation of openRecommendations) {
    groupCounts.set(recommendation.group, (groupCounts.get(recommendation.group) ?? 0) + 1);
  }
  const topPriorities = Array.isArray(latest?.topPriorities)
    ? (latest.topPriorities as Array<{ title?: string }>)
    : [];
  const businessHealth = decimalToNumber(
    latest?.businessHealthScore ?? latest?.operationsHealthScore,
  );

  return {
    todaysPriority: topPriorities[0]?.title ?? openRecommendations[0]?.title ?? null,
    businessHealth,
    executiveConfidence: Math.round(decimalToNumber(latest?.confidence) * 100),
    merchantCapacity: decimalToNumber(
      (latest?.merchantCapacity as Record<string, unknown> | undefined)?.capacityScore,
    ),
    businessMomentum: decimalToNumber(latest?.businessMomentum ?? businessHealth),
    criticalPathLength: openRecommendations.filter((item) => item.priority === 1).length,
    executionTimeline: businessHealthHistory.length > 0 ? businessHealthHistory : [{ label: "Current", value: businessHealth }],
    priorityDistribution: [...groupCounts.entries()].map(([label, value]) => ({ label, value })),
    businessHealthTrend: businessHealthHistory.length > 0 ? businessHealthHistory : [{ label: "Current", value: businessHealth }],
    capacityUsage: [
      { label: "Capacity", value: businessHealth },
      { label: "Open Priorities", value: openRecommendations.length },
    ],
    opportunityCostChart: [
      { label: "Revenue", value: decimalToNumber(latest?.revenueOpportunity) },
      { label: "Inventory Risk", value: decimalToNumber(latest?.inventoryRisk) },
    ],
    dependencyGraph: openRecommendations.slice(0, 5).map((item, index) => ({
      label: item.title.slice(0, 18),
      value: 5 - index,
    })),
    executionFunnel: [
      { label: "Critical", value: openRecommendations.filter((item) => item.priority === 1).length },
      { label: "High", value: openRecommendations.filter((item) => item.priority === 2).length },
      { label: "Medium", value: openRecommendations.filter((item) => item.priority === 3).length },
      { label: "Low", value: openRecommendations.filter((item) => item.priority >= 4).length },
    ],
    businessMomentumChart: businessHealthHistory.length > 0 ? businessHealthHistory : [{ label: "Current", value: businessHealth }],
    criticalPathChart: openRecommendations.slice(0, 5).map((item, index) => ({
      label: item.title.slice(0, 18),
      value: 5 - index,
    })),
    blockedTasksChart: [{ label: "Blocked", value: Array.isArray(latest?.blockers) ? latest.blockers.length : 0 }],
  };
}

export function buildStoreAuditPanel(input: {
  storeAuditResults: Array<{ resultJson: unknown }>;
  auditRecommendations: ExecutiveRecommendationView[];
}): ExecutiveStoreAuditPanel {
  const latest = input.storeAuditResults[input.storeAuditResults.length - 1]?.resultJson as
    | Record<string, unknown>
    | undefined;

  const overallAuditScore = decimalToNumber(latest?.overallAuditScore ?? latest?.storeHealthScore);
  const auditHistory = input.storeAuditResults.map((entry, index) => ({
    label: `Run ${index + 1}`,
    value: decimalToNumber((entry.resultJson as Record<string, unknown>).storeHealthScore),
  }));

  return {
    overallAuditScore,
    auditHealth: overallAuditScore,
    criticalIssues: input.auditRecommendations.filter((item) => item.priority === 1).length,
    seoHealth: decimalToNumber(latest?.seoScore),
    performanceHealth: decimalToNumber(latest?.performanceScore),
    accessibilityHealth: decimalToNumber(latest?.accessibilityScore),
    auditHistory: auditHistory.length > 0 ? auditHistory : [{ label: "Current", value: 0 }],
    auditTimeline: [
      { label: "Health", value: overallAuditScore },
      { label: "SEO", value: decimalToNumber(latest?.seoScore) },
      { label: "Performance", value: decimalToNumber(latest?.performanceScore) },
      { label: "Accessibility", value: decimalToNumber(latest?.accessibilityScore) },
    ],
    trendChart: auditHistory.length > 0 ? auditHistory : [{ label: "Current", value: overallAuditScore }],
  };
}

async function buildProductSpotlight(
  storeId: string,
  recommendations: ExecutiveRecommendationView[],
): Promise<ExecutiveProductSpotlight | null> {
  const candidate = [...recommendations]
    .filter((item) => ["open", "viewed"].includes(item.status) && item.productId)
    .sort(
      (left, right) =>
        sumImpact(right.estimatedImpact) - sumImpact(left.estimatedImpact) ||
        left.priority - right.priority,
    )[0];

  if (!candidate?.productId) {
    return null;
  }

  const [product, latestResult] = await Promise.all([
    prisma.product.findFirst({
      where: { storeId, id: candidate.productId },
      select: { id: true, title: true, inventoryQuantity: true },
    }),
    prisma.aiAgentResult.findFirst({
      where: {
        storeId,
        agentId: "product_intelligence",
        subjectKey: candidate.subjectKey,
        isSuccess: true,
      },
      orderBy: { createdAt: "desc" },
      select: { resultJson: true },
    }),
  ]);

  if (!product) {
    return null;
  }

  const resultJson = (latestResult?.resultJson as Record<string, unknown> | undefined) ?? {};
  const productRecommendations = recommendations.filter(
    (item) => item.productId === product.id && ["open", "viewed"].includes(item.status),
  );

  return {
    productId: product.id,
    title: product.title,
    healthScore:
      resultJson.healthScore == null ? null : decimalToNumber(resultJson.healthScore),
    revenueTrend: String(
      (resultJson.summary as string | undefined) ?? "Revenue trend available in Product Intelligence",
    ),
    inventoryDays: decimalToNumber(
      ((resultJson as Record<string, unknown>).daysRemaining as number | undefined) ?? 0,
    ) || null,
    velocity: null,
    risk: productRecommendations.find((item) => item.group === "Critical Risks")?.title ?? null,
    opportunity:
      productRecommendations.find((item) => item.group === "Revenue Opportunities")?.title ?? null,
    recommendations: productRecommendations,
    expectedRevenueImpact: productRecommendations.reduce(
      (total, item) => total + sumImpact(item.estimatedImpact),
      0,
    ),
    healthExplanation:
      (resultJson.healthExplanation as Record<string, unknown> | undefined) ?? null,
  };
}

export async function getExecutiveDashboard(
  storeId: string,
  currency = "USD",
): Promise<ExecutiveDashboardData> {
  return getOrComputeCached(
    executiveDashboardCache,
    `${storeId}:${currency}`,
    () => buildExecutiveDashboardUncached(storeId, currency),
  );
}

const executiveDashboardCache = new TimedCache<ExecutiveDashboardData>(45_000);

async function buildExecutiveDashboardUncached(
  storeId: string,
  currency = "USD",
): Promise<ExecutiveDashboardData> {
  const [metrics, recommendationRecords] = await Promise.all([
    getStoreMetrics(storeId),
    prisma.aiRecommendation.findMany({
      where: { storeId },
      orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
      take: 100,
    }),
  ]);

  const productIds = recommendationRecords
    .map((record) => parseProductId(record.subjectKey))
    .filter((value): value is string => Boolean(value));

  const products = productIds.length
    ? await prisma.product.findMany({
        where: { storeId, id: { in: [...new Set(productIds)] } },
        select: { id: true, title: true },
      })
    : [];
  const productTitles = new Map(products.map((product) => [product.id, product.title]));

  const recommendations = recommendationRecords.map((record) =>
    mapRecommendationRecord({
      ...record,
      productTitle: productTitles.get(parseProductId(record.subjectKey) ?? "") ?? null,
    }),
  );

  const storeHealthScore = serializeHealthScoreForLoader(calculateStoreHealthScore(metrics));
  const aiConfidence =
    recommendations.length > 0
      ? recommendations.reduce((total, item) => total + item.confidence, 0) /
        recommendations.length
      : 0;

  const latestAiHealth = await prisma.aiAgentResult.findFirst({
    where: { storeId, agentId: "product_intelligence", isSuccess: true },
    orderBy: { createdAt: "desc" },
    select: { resultJson: true, createdAt: true },
  });

  const aiStoreHealth = latestAiHealth
    ? decimalToNumber((latestAiHealth.resultJson as Record<string, unknown>).healthScore)
    : storeHealthScore.score;

  const [analytics, productSpotlight, collaborationOutput] = await Promise.all([
    buildAnalytics(storeId, recommendations),
    buildProductSpotlight(storeId, recommendations),
    loadLatestCollaborationOutputFromStore({ storeId }),
  ]);

  const auditRecommendations = recommendations.filter((item) =>
    item.subjectKey.startsWith("store-audit:"),
  );
  const seoRecommendations = recommendations.filter((item) =>
    item.subjectKey.startsWith("seo-intelligence:"),
  );
  const pricingRecommendations = recommendations.filter((item) =>
    item.subjectKey.startsWith("pricing-intelligence:"),
  );
  const growthRecommendations = recommendations.filter((item) =>
    item.subjectKey.startsWith("growth-intelligence:"),
  );
  const executiveCooRecommendations = recommendations.filter((item) =>
    item.subjectKey.startsWith("executive-coo:"),
  );
  const storeAuditPanel = buildStoreAuditPanel({
    storeAuditResults: await prisma.aiAgentResult.findMany({
      where: { storeId, agentId: "store_audit", isSuccess: true },
      orderBy: { createdAt: "asc" },
      take: 20,
      select: { resultJson: true },
    }),
    auditRecommendations,
  });
  const seoIntelligencePanel = buildSeoIntelligencePanel({
    seoIntelligenceResults: await prisma.aiAgentResult.findMany({
      where: { storeId, agentId: "seo_audit", isSuccess: true },
      orderBy: { createdAt: "asc" },
      take: 20,
      select: { resultJson: true },
    }),
    seoRecommendations,
  });
  const pricingIntelligencePanel = buildPricingIntelligencePanel({
    pricingIntelligenceResults: await prisma.aiAgentResult.findMany({
      where: { storeId, agentId: "pricing_intelligence", isSuccess: true },
      orderBy: { createdAt: "asc" },
      take: 20,
      select: { resultJson: true },
    }),
    pricingRecommendations,
  });
  const growthIntelligencePanel = buildGrowthIntelligencePanel({
    growthIntelligenceResults: await prisma.aiAgentResult.findMany({
      where: { storeId, agentId: "growth_intelligence", isSuccess: true },
      orderBy: { createdAt: "asc" },
      take: 20,
      select: { resultJson: true },
    }),
    growthRecommendations,
  });
  const executiveCooPanel = buildExecutiveCooPanel({
    executiveCooResults: await prisma.aiAgentResult.findMany({
      where: { storeId, agentId: "executive_coo", isSuccess: true },
      orderBy: { createdAt: "asc" },
      take: 20,
      select: { resultJson: true },
    }),
    executiveRecommendations: executiveCooRecommendations,
  });

  const collaboration = collaborationOutput
    ? mapCollaborationToExecutiveViews(collaborationOutput)
    : null;

  const summaryCards = buildSummaryCards({
    metrics,
    storeHealthScore: { ...storeHealthScore, score: aiStoreHealth || storeHealthScore.score },
    recommendations,
    aiConfidence: Math.round(aiConfidence * 100) / 100,
  });

  return {
    summaryCards,
    briefing: buildBriefing({
      recommendations,
      metrics,
      storeHealth: summaryCards.storeHealth,
      currency,
    }),
    groupedRecommendations: groupRecommendations(recommendations),
    executiveDecisions: collaboration?.decisions ?? [],
    collaborationSummary: collaboration?.summary ?? null,
    collaborationCharts: collaboration?.charts ?? buildEmptyCollaborationCharts(),
    productSpotlight,
    analytics,
    storeAuditPanel,
    seoIntelligencePanel,
    pricingIntelligencePanel,
    growthIntelligencePanel,
    executiveCooPanel,
    timeline: buildTimeline(recommendations),
    tasks: buildTasks(recommendations),
    recommendations,
    storeHealthScore,
    metrics: serializeMetricsForLoader(metrics),
    currency,
    lastUpdatedAt: latestAiHealth?.createdAt.toISOString() ?? null,
  };
}

export function serializeExecutiveDashboardForLoader(
  dashboard: ExecutiveDashboardData,
): ExecutiveDashboardData {
  return JSON.parse(JSON.stringify(dashboard)) as ExecutiveDashboardData;
}

export function findRecommendationByStableId(
  dashboard: ExecutiveDashboardData,
  stableId: string,
): ExecutiveRecommendationView | null {
  return dashboard.recommendations.find((item) => item.stableId === stableId) ?? null;
}
