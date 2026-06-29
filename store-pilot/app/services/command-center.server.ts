import prisma from "../db.server";
import { getAiUsageSummary } from "./ai-cost-control.server";
import {
  getExecutiveDashboard,
} from "./executive-dashboard.server";
import type {
  ExecutiveChartPoint,
  ExecutiveDashboardData,
  ExecutiveEstimatedImpact,
  ExecutiveRecommendationView,
} from "./executive-dashboard.types";
export type {
  CommandCenterActivityTone,
  CommandCenterActivityItem,
  CommandCenterAgentCard,
  CommandCenterHealthSegment,
  CommandCenterHealthRing,
  CommandCenterCostWidget,
  CommandCenterBriefing,
  CommandCenterTimelineItem,
  CommandCenterPipeline,
  CommandCenterCharts,
  CommandCenterHeader,
  CommandCenterInventoryIntelligence,
  CommandCenterBundleDiscovery,
  CommandCenterStoreAudit,
  CommandCenterTrendIntelligence,
  CommandCenterSeoIntelligence,
  CommandCenterPricingIntelligence,
  CommandCenterGrowthIntelligence,
  CommandCenterExecutiveCoo,
  CommandCenterExecutiveDecisions,
  CommandCenterData,
} from "./command-center.types";
export type {
  ExecutiveChartPoint,
  ExecutiveDashboardData,
  ExecutiveEstimatedImpact,
  ExecutiveRecommendationView,
} from "./executive-dashboard.types";
import { getStoreSyncStatus } from "./sync-status.server";
import { formatCurrency } from "./metrics.server";
import { formatDurationMs, formatRelativeTime } from "../lib/format";
import { getOrComputeCached, TimedCache } from "../lib/timed-cache.server";

import type {
  CommandCenterActivityItem,
  CommandCenterActivityTone,
  CommandCenterAgentCard,
  CommandCenterBriefing,
  CommandCenterCharts,
  CommandCenterData,
  CommandCenterExecutiveDecisions,
  CommandCenterHealthRing,
  CommandCenterPipeline,
  CommandCenterSeoIntelligence,
  CommandCenterPricingIntelligence,
  CommandCenterGrowthIntelligence,
  CommandCenterExecutiveCoo,
  CommandCenterInventoryIntelligence,
  CommandCenterBundleDiscovery,
  CommandCenterStoreAudit,
  CommandCenterTrendIntelligence,
  CommandCenterTimelineItem,
} from "./command-center.types";
export { formatRelativeTime, formatDurationMs } from "../lib/format";


function sumImpact(impact: ExecutiveEstimatedImpact): number {
  return (
    (impact.revenueRecovered ?? 0) +
    (impact.revenueOpportunity ?? 0) +
    (impact.estimatedLostSales ?? 0) +
    (impact.marginImprovement ?? 0) +
    (impact.inventoryCostSaved ?? 0)
  );
}

function decimalToNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 17) {
    return "Good afternoon";
  }

  return "Good evening";
}

export function resolveMerchantDisplayName(input: {
  firstName?: string | null;
  lastName?: string | null;
  shopName?: string | null;
}): string {
  const fullName = [input.firstName, input.lastName].filter(Boolean).join(" ").trim();
  if (fullName) {
    return fullName.split(" ")[0] ?? fullName;
  }

  if (input.shopName) {
    return input.shopName;
  }

  return "there";
}


export function buildHealthRing(input: {
  storeHealth: number;
  inventoryHealth: number;
  revenueHealth: number;
  growthScore: number;
  recommendations: ExecutiveRecommendationView[];
}): CommandCenterHealthRing {
  const categoryScore = (category: string, fallback: number) => {
    const matches = input.recommendations.filter((item) => item.category === category);
    if (matches.length === 0) {
      return fallback;
    }

    const averageConfidence =
      matches.reduce((total, item) => total + item.confidence, 0) / matches.length;

    return Math.round(Math.max(0, Math.min(100, averageConfidence * 100)));
  };

  return {
    score: input.storeHealth,
    segments: [
      { label: "Inventory", value: input.inventoryHealth },
      { label: "Revenue", value: input.revenueHealth },
      { label: "Conversion", value: input.growthScore },
      { label: "SEO", value: categoryScore("SEO", Math.max(40, input.storeHealth - 8)) },
      { label: "Pricing", value: categoryScore("Pricing", Math.max(40, input.storeHealth - 12)) },
    ],
  };
}

export function buildOpportunityPipeline(
  recommendations: ExecutiveRecommendationView[],
): CommandCenterPipeline {
  const open = recommendations.filter((item) => ["open", "viewed"].includes(item.status));

  return {
    critical: open.filter((item) => item.priority === 1),
    high: open.filter((item) => item.priority === 2),
    medium: open.filter((item) => item.priority === 3),
    low: open.filter((item) => item.priority >= 4),
  };
}

function extractResultSummary(resultJson: Record<string, unknown>): string {
  return String(resultJson.summary ?? resultJson.executiveSummary ?? "").trim();
}

export function buildCommandCenterBriefing(input: {
  analyzedProducts: number;
  recommendations: ExecutiveRecommendationView[];
  resultSummaries: string[];
  currency: string;
}): CommandCenterBriefing {
  const openRecommendations = input.recommendations.filter((item) =>
    ["open", "viewed"].includes(item.status),
  );
  const critical = openRecommendations.filter((item) => item.group === "Critical Risks");
  const opportunities = openRecommendations.filter(
    (item) => item.group === "Revenue Opportunities" || item.group === "Quick Wins",
  );
  const topImpact = [...openRecommendations]
    .sort((left, right) => sumImpact(right.estimatedImpact) - sumImpact(left.estimatedImpact))
    .slice(0, 3);
  const monthlyImpact = topImpact.reduce((total, item) => total + sumImpact(item.estimatedImpact), 0);
  const momentumSummary =
    input.resultSummaries.find((summary) => /declin|slow|risk|drop/i.test(summary)) ??
    input.resultSummaries[0] ??
    null;
  const breakoutSummary =
    [...input.resultSummaries]
      .reverse()
      .find((summary) => /grow|breakout|strong|increase|surge/i.test(summary)) ?? null;

  const paragraphs = [
    input.analyzedProducts > 0
      ? `Your AI COO analyzed ${input.analyzedProducts} product${input.analyzedProducts === 1 ? "" : "s"} using persisted Product Intelligence results.`
      : "Your AI COO is ready to analyze products once Product Intelligence runs complete.",
    critical.length > 0 && opportunities.length > 0
      ? `${critical.length} product${critical.length === 1 ? " is" : "s are"} losing momentum while ${opportunities.length} opportunit${opportunities.length === 1 ? "y is" : "ies are"} ready for action.`
      : momentumSummary
        ? momentumSummary
        : "Product Intelligence summaries will appear here after the first successful analysis run.",
    breakoutSummary ? breakoutSummary : null,
    monthlyImpact > 0
      ? `Implementing the top three recommendations could increase monthly revenue by approximately ${formatCurrency(monthlyImpact, input.currency)}.`
      : null,
  ].filter((paragraph): paragraph is string => Boolean(paragraph));

  return {
    headline: "Your AI COO has analyzed your store.",
    paragraphs,
  };
}

async function buildActivityFeed(input: {
  storeId: string;
  currency: string;
  syncStatus: Awaited<ReturnType<typeof getStoreSyncStatus>>;
}): Promise<CommandCenterActivityItem[]> {
  const [runs, inventoryRuns, bundleRuns, verifiedRecommendations, skippedRuns] = await Promise.all([
    prisma.aiAgentRun.findMany({
      where: {
        storeId: input.storeId,
        agentId: "product_intelligence",
        status: { in: ["succeeded", "cached"] },
      },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: {
        recommendations: {
          select: {
            payloadJson: true,
          },
        },
      },
    }),
    prisma.aiAgentRun.findMany({
      where: {
        storeId: input.storeId,
        agentId: "inventory_intelligence",
        status: { in: ["succeeded", "cached"] },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        recommendations: {
          select: {
            payloadJson: true,
          },
        },
      },
    }),
    prisma.aiAgentRun.findMany({
      where: {
        storeId: input.storeId,
        agentId: "bundle_discovery",
        status: { in: ["succeeded", "cached"] },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        recommendations: {
          select: {
            payloadJson: true,
          },
        },
      },
    }),
    prisma.aiRecommendation.findMany({
      where: {
        storeId: input.storeId,
        status: "verified",
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    prisma.aiAgentRun.findMany({
      where: {
        storeId: input.storeId,
        agentId: "product_intelligence",
        status: "skipped",
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const feed: CommandCenterActivityItem[] = [];

  const runsByDay = new Map<string, typeof runs>();
  for (const run of runs) {
    const dayKey = (run.completedAt ?? run.createdAt).toISOString().slice(0, 10);
    const bucket = runsByDay.get(dayKey) ?? [];
    bucket.push(run);
    runsByDay.set(dayKey, bucket);
  }

  for (const [dayKey, dayRuns] of runsByDay) {
    const analyzedProducts = new Set(dayRuns.map((run) => run.subjectKey)).size;
    const recommendationCount = dayRuns.reduce((total, run) => total + run.recommendations.length, 0);
    const recommendationImpact = dayRuns.reduce((total, run) => {
      return (
        total +
        run.recommendations.reduce((runTotal, recommendation) => {
          const payload = recommendation.payloadJson as Record<string, unknown>;
          return runTotal + sumImpact(parseImpactPayload(payload));
        }, 0)
      );
    }, 0);
    const durationMs = Math.max(...dayRuns.map((run) => run.latencyMs));
    const latestAt = dayRuns
      .map((run) => run.completedAt ?? run.createdAt)
      .sort((left, right) => right.getTime() - left.getTime())[0];

    feed.push({
      id: `run-batch:${dayKey}`,
      tone: "success",
      title: "Product Intelligence completed",
      detail: `Analyzed ${analyzedProducts} product${analyzedProducts === 1 ? "" : "s"}`,
      metrics: [
        { label: "Duration", value: formatDurationMs(durationMs) },
        { label: "Recommendations", value: String(recommendationCount) },
        {
          label: "Estimated Revenue",
          value:
            recommendationImpact > 0
              ? `+${formatCurrency(recommendationImpact, input.currency)}`
              : "â€”",
        },
      ],
      at: latestAt?.toISOString() ?? dayKey,
    });
  }

  for (const run of inventoryRuns) {
    feed.push({
      id: `inventory-run:${run.id}`,
      tone: "success",
      title: "Inventory Intelligence completed",
      detail: "Store-wide inventory analysis completed",
      metrics: [
        { label: "Duration", value: formatDurationMs(run.latencyMs) },
        { label: "Recommendations", value: String(run.recommendations.length) },
        {
          label: "Stock Alerts",
          value: String(
            run.recommendations.filter((item) => {
              const payload = item.payloadJson as Record<string, unknown>;
              return payload.category === "Stockout";
            }).length,
          ),
        },
      ],
      at: (run.completedAt ?? run.createdAt).toISOString(),
    });
  }

  for (const run of bundleRuns) {
    feed.push({
      id: `bundle-run:${run.id}`,
      tone: "success",
      title: "Bundle Discovery completed",
      detail: "Recent bundle discoveries generated from synchronized commerce data",
      metrics: [
        { label: "Duration", value: formatDurationMs(run.latencyMs) },
        { label: "Recommendations", value: String(run.recommendations.length) },
        {
          label: "Bundle Actions",
          value: String(run.recommendations.length),
        },
      ],
      at: (run.completedAt ?? run.createdAt).toISOString(),
    });
  }

  if (!input.syncStatus.inventory.synced) {
    feed.push({
      id: "inventory-sync-waiting",
      tone: "warning",
      title: "Inventory Intelligence",
      detail: "Waiting for inventory sync",
      metrics: [{ label: "Status", value: "Sync required" }],
      at: new Date().toISOString(),
    });
  }

  for (const recommendation of verifiedRecommendations) {
    const payload = recommendation.payloadJson as Record<string, unknown>;
    feed.push({
      id: `verified:${recommendation.stableId}`,
      tone: "success",
      title: "Recommendation Verified",
      detail: recommendation.title,
      metrics: [
        {
          label: "Outcome",
          value: String(payload.expectedResult ?? "Metrics improved"),
        },
      ],
      at: recommendation.updatedAt.toISOString(),
    });
  }

  for (const run of skippedRuns) {
    feed.push({
      id: `skipped:${run.id}`,
      tone: "danger",
      title: "Product analysis skipped",
      detail: run.errorCode === "budget_exceeded" ? "Budget exhausted" : run.errorMessage ?? "Skipped",
      metrics: [{ label: "Reason", value: run.errorCode ?? "skipped" }],
      at: (run.completedAt ?? run.createdAt).toISOString(),
    });
  }

  return feed.sort((left, right) => right.at.localeCompare(left.at)).slice(0, 12);
}

function parseImpactPayload(payload: Record<string, unknown>): ExecutiveEstimatedImpact {
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

async function buildAgentCards(storeId: string): Promise<CommandCenterAgentCard[]> {
  const [
    latestProductRun,
    productAggregate,
    productRecommendationCount,
    latestInventoryRun,
    inventoryAggregate,
    inventoryRecommendationCount,
    latestBundleRun,
    bundleAggregate,
    bundleRecommendationCount,
    latestStoreAuditRun,
    storeAuditAggregate,
    storeAuditRecommendationCount,
    latestTrendRun,
    trendAggregate,
    trendRecommendationCount,
    latestSeoRun,
    seoAggregate,
    seoRecommendationCount,
    latestPricingRun,
    pricingAggregate,
    pricingRecommendationCount,
  ] = await Promise.all([
    prisma.aiAgentRun.findFirst({
      where: { storeId, agentId: "product_intelligence" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.aiAgentRun.aggregate({
      where: {
        storeId,
        agentId: "product_intelligence",
        status: { in: ["succeeded", "cached"] },
      },
      _avg: { latencyMs: true },
      _sum: { estimatedCostUsd: true },
      _count: { _all: true },
    }),
    prisma.aiRecommendation.count({
      where: { storeId, agentId: "product_intelligence" },
    }),
    prisma.aiAgentRun.findFirst({
      where: { storeId, agentId: "inventory_intelligence" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.aiAgentRun.aggregate({
      where: {
        storeId,
        agentId: "inventory_intelligence",
        status: { in: ["succeeded", "cached"] },
      },
      _avg: { latencyMs: true },
      _sum: { estimatedCostUsd: true },
      _count: { _all: true },
    }),
    prisma.aiRecommendation.count({
      where: { storeId, agentId: "inventory_intelligence" },
    }),
    prisma.aiAgentRun.findFirst({
      where: { storeId, agentId: "bundle_discovery" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.aiAgentRun.aggregate({
      where: {
        storeId,
        agentId: "bundle_discovery",
        status: { in: ["succeeded", "cached"] },
      },
      _avg: { latencyMs: true },
      _sum: { estimatedCostUsd: true },
      _count: { _all: true },
    }),
    prisma.aiRecommendation.count({
      where: { storeId, agentId: "bundle_discovery" },
    }),
    prisma.aiAgentRun.findFirst({
      where: { storeId, agentId: "store_audit" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.aiAgentRun.aggregate({
      where: {
        storeId,
        agentId: "store_audit",
        status: { in: ["succeeded", "cached"] },
      },
      _avg: { latencyMs: true },
      _sum: { estimatedCostUsd: true },
      _count: { _all: true },
    }),
    prisma.aiRecommendation.count({
      where: { storeId, agentId: "store_audit" },
    }),
    prisma.aiAgentRun.findFirst({
      where: { storeId, agentId: "trend_intelligence" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.aiAgentRun.aggregate({
      where: {
        storeId,
        agentId: "trend_intelligence",
        status: { in: ["succeeded", "cached"] },
      },
      _avg: { latencyMs: true },
      _sum: { estimatedCostUsd: true },
      _count: { _all: true },
    }),
    prisma.aiRecommendation.count({
      where: { storeId, agentId: "trend_intelligence" },
    }),
    prisma.aiAgentRun.findFirst({
      where: { storeId, agentId: "seo_audit" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.aiAgentRun.aggregate({
      where: {
        storeId,
        agentId: "seo_audit",
        status: { in: ["succeeded", "cached"] },
      },
      _avg: { latencyMs: true },
      _sum: { estimatedCostUsd: true },
      _count: { _all: true },
    }),
    prisma.aiRecommendation.count({
      where: { storeId, agentId: "seo_audit" },
    }),
    prisma.aiAgentRun.findFirst({
      where: { storeId, agentId: "pricing_intelligence" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.aiAgentRun.aggregate({
      where: {
        storeId,
        agentId: "pricing_intelligence",
        status: { in: ["succeeded", "cached"] },
      },
      _avg: { latencyMs: true },
      _sum: { estimatedCostUsd: true },
      _count: { _all: true },
    }),
    prisma.aiRecommendation.count({
      where: { storeId, agentId: "pricing_intelligence" },
    }),
  ]);

  const productIntelligence: CommandCenterAgentCard = {
    id: "product_intelligence",
    name: "Product Intelligence",
    status: latestProductRun ? "healthy" : "waiting",
    description: "Analyzes product performance and generates merchant-ready recommendations.",
    lastRunAt: latestProductRun
      ? (latestProductRun.completedAt ?? latestProductRun.createdAt).toISOString()
      : null,
    durationMs: latestProductRun?.latencyMs ?? null,
    recommendationCount: productRecommendationCount,
    costUsd: decimalToNumber(productAggregate._sum.estimatedCostUsd),
    latencyMs: productAggregate._avg.latencyMs ? Math.round(productAggregate._avg.latencyMs) : null,
    healthLabel: latestProductRun ? "Healthy" : "Waiting for first run",
  };

  const inventoryIntelligence: CommandCenterAgentCard = {
    id: "inventory_intelligence",
    name: "Inventory Intelligence",
    status: latestInventoryRun ? "healthy" : "waiting",
    description: "Predict stockouts, rebalance inventory, and protect operations before shelves go empty.",
    lastRunAt: latestInventoryRun
      ? (latestInventoryRun.completedAt ?? latestInventoryRun.createdAt).toISOString()
      : null,
    durationMs: latestInventoryRun?.latencyMs ?? null,
    recommendationCount: inventoryRecommendationCount,
    costUsd: decimalToNumber(inventoryAggregate._sum.estimatedCostUsd),
    latencyMs: inventoryAggregate._avg.latencyMs
      ? Math.round(inventoryAggregate._avg.latencyMs)
      : null,
    healthLabel: latestInventoryRun ? "Healthy" : "Waiting for first run",
  };

  const bundleDiscovery: CommandCenterAgentCard = {
    id: "bundle_discovery",
    name: "Bundle Discovery",
    status: latestBundleRun ? "healthy" : "waiting",
    description: "Find high-converting bundles and merchandising pairs automatically.",
    lastRunAt: latestBundleRun
      ? (latestBundleRun.completedAt ?? latestBundleRun.createdAt).toISOString()
      : null,
    durationMs: latestBundleRun?.latencyMs ?? null,
    recommendationCount: bundleRecommendationCount,
    costUsd: decimalToNumber(bundleAggregate._sum.estimatedCostUsd),
    latencyMs: bundleAggregate._avg.latencyMs ? Math.round(bundleAggregate._avg.latencyMs) : null,
    healthLabel: latestBundleRun ? "Healthy" : "Waiting for first run",
  };

  const storeAudit: CommandCenterAgentCard = {
    id: "store_audit",
    name: "Store Audit Intelligence",
    status: latestStoreAuditRun ? "healthy" : "waiting",
    description: "Audit homepage, SEO, performance, accessibility, and conversion readiness.",
    lastRunAt: latestStoreAuditRun
      ? (latestStoreAuditRun.completedAt ?? latestStoreAuditRun.createdAt).toISOString()
      : null,
    durationMs: latestStoreAuditRun?.latencyMs ?? null,
    recommendationCount: storeAuditRecommendationCount,
    costUsd: decimalToNumber(storeAuditAggregate._sum.estimatedCostUsd),
    latencyMs: storeAuditAggregate._avg.latencyMs
      ? Math.round(storeAuditAggregate._avg.latencyMs)
      : null,
    healthLabel: latestStoreAuditRun ? "Healthy" : "Waiting for first run",
  };

  const trendIntelligence: CommandCenterAgentCard = {
    id: "trend_intelligence",
    name: "Trend Intelligence",
    status: latestTrendRun ? "healthy" : "waiting",
    description: "Detect breakout products, slowing SKUs, and category momentum shifts.",
    lastRunAt: latestTrendRun
      ? (latestTrendRun.completedAt ?? latestTrendRun.createdAt).toISOString()
      : null,
    durationMs: latestTrendRun?.latencyMs ?? null,
    recommendationCount: trendRecommendationCount,
    costUsd: decimalToNumber(trendAggregate._sum.estimatedCostUsd),
    latencyMs: trendAggregate._avg.latencyMs ? Math.round(trendAggregate._avg.latencyMs) : null,
    healthLabel: latestTrendRun ? "Healthy" : "Waiting for first run",
  };

  const seoIntelligence: CommandCenterAgentCard = {
    id: "seo_audit",
    name: "SEO Intelligence",
    status: latestSeoRun ? "healthy" : "waiting",
    description: "Monitor SEO best practices, visibility, and organic growth opportunities.",
    lastRunAt: latestSeoRun
      ? (latestSeoRun.completedAt ?? latestSeoRun.createdAt).toISOString()
      : null,
    durationMs: latestSeoRun?.latencyMs ?? null,
    recommendationCount: seoRecommendationCount,
    costUsd: decimalToNumber(seoAggregate._sum.estimatedCostUsd),
    latencyMs: seoAggregate._avg.latencyMs ? Math.round(seoAggregate._avg.latencyMs) : null,
    healthLabel: latestSeoRun ? "Healthy" : "Waiting for first run",
  };

  const pricingIntelligence: CommandCenterAgentCard = {
    id: "pricing_intelligence",
    name: "Pricing Strategy Intelligence",
    status: latestPricingRun ? "healthy" : "waiting",
    description: "Identify margin risks, discount abuse, premium opportunities, and pricing strategy gaps.",
    lastRunAt: latestPricingRun
      ? (latestPricingRun.completedAt ?? latestPricingRun.createdAt).toISOString()
      : null,
    durationMs: latestPricingRun?.latencyMs ?? null,
    recommendationCount: pricingRecommendationCount,
    costUsd: decimalToNumber(pricingAggregate._sum.estimatedCostUsd),
    latencyMs: pricingAggregate._avg.latencyMs ? Math.round(pricingAggregate._avg.latencyMs) : null,
    healthLabel: latestPricingRun ? "Healthy" : "Waiting for first run",
  };

  return [
    productIntelligence,
    inventoryIntelligence,
    bundleDiscovery,
    storeAudit,
    trendIntelligence,
    seoIntelligence,
    pricingIntelligence,
  ];
}

export async function buildInventoryIntelligenceWidget(
  storeId: string,
  recommendations: ExecutiveRecommendationView[],
): Promise<CommandCenterInventoryIntelligence> {
  const [latestResult, recentExecutions] = await Promise.all([
    prisma.aiAgentResult.findFirst({
      where: { storeId, agentId: "inventory_intelligence", isSuccess: true },
      orderBy: { createdAt: "desc" },
      select: { resultJson: true },
    }),
    prisma.aiAgentRun.count({
      where: {
        storeId,
        agentId: "inventory_intelligence",
        status: { in: ["succeeded", "cached"] },
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  const resultJson = (latestResult?.resultJson as Record<string, unknown> | undefined) ?? {};
  const inventoryRecommendations = recommendations.filter((item) =>
    item.subjectKey.startsWith("inventory:"),
  );
  const openInventoryRecommendations = inventoryRecommendations.filter((item) =>
    ["open", "viewed"].includes(item.status),
  );
  const groupCounts = new Map<string, number>();

  for (const recommendation of openInventoryRecommendations) {
    groupCounts.set(recommendation.group, (groupCounts.get(recommendation.group) ?? 0) + 1);
  }

  return {
    inventoryHealth: decimalToNumber(resultJson.inventoryHealthScore) || 0,
    openRecommendations: openInventoryRecommendations.length,
    stockoutAlerts: decimalToNumber(resultJson.stockoutAlertCount),
    deadStockAlerts: decimalToNumber(resultJson.deadStockCount),
    recentExecutions,
    capitalLocked: decimalToNumber(resultJson.capitalLockedInInventory),
    averageWeeksOfCover:
      resultJson.averageWeeksOfCover == null
        ? null
        : decimalToNumber(resultJson.averageWeeksOfCover),
    fastMovers: decimalToNumber(resultJson.fastMoverCount),
    slowMovers: decimalToNumber(resultJson.slowMoverCount),
    inventoryAlerts: [
      { label: "Stockout", value: decimalToNumber(resultJson.stockoutAlertCount) },
      { label: "Dead Stock", value: decimalToNumber(resultJson.deadStockCount) },
      { label: "Overstock", value: decimalToNumber(resultJson.overstockCount) },
      { label: "Understock", value: decimalToNumber(resultJson.understockCount) },
    ],
    recommendationGroups: [...groupCounts.entries()].map(([label, value]) => ({ label, value })),
    opportunityPipeline: [
      { label: "Critical", value: openInventoryRecommendations.filter((item) => item.priority === 1).length },
      { label: "High", value: openInventoryRecommendations.filter((item) => item.priority === 2).length },
      { label: "Medium", value: openInventoryRecommendations.filter((item) => item.priority === 3).length },
      { label: "Low", value: openInventoryRecommendations.filter((item) => item.priority >= 4).length },
    ],
    inventoryTrend: [
      { label: "Health", value: decimalToNumber(resultJson.inventoryHealthScore) },
      { label: "Capital", value: decimalToNumber(resultJson.capitalLockedInInventory) },
      { label: "Fast", value: decimalToNumber(resultJson.fastMoverCount) },
      { label: "Slow", value: decimalToNumber(resultJson.slowMoverCount) },
    ],
  };
}

export async function buildBundleDiscoveryWidget(
  storeId: string,
  recommendations: ExecutiveRecommendationView[],
): Promise<CommandCenterBundleDiscovery> {
  const [latestResult, recentExecutions] = await Promise.all([
    prisma.aiAgentResult.findFirst({
      where: { storeId, agentId: "bundle_discovery", isSuccess: true },
      orderBy: { createdAt: "desc" },
      select: { resultJson: true },
    }),
    prisma.aiAgentRun.count({
      where: {
        storeId,
        agentId: "bundle_discovery",
        status: { in: ["succeeded", "cached"] },
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  const resultJson = (latestResult?.resultJson as Record<string, unknown> | undefined) ?? {};
  const bundleRecommendations = recommendations.filter((item) => item.subjectKey.startsWith("bundle:"));
  const openBundleRecommendations = bundleRecommendations.filter((item) =>
    ["open", "viewed"].includes(item.status),
  );
  const groupCounts = new Map<string, number>();

  for (const recommendation of openBundleRecommendations) {
    groupCounts.set(recommendation.group, (groupCounts.get(recommendation.group) ?? 0) + 1);
  }

  return {
    bundleHealth: decimalToNumber(resultJson.bundleHealthScore),
    openRecommendations: openBundleRecommendations.length,
    topOpportunities: Array.isArray(resultJson.bundleCandidates)
      ? (resultJson.bundleCandidates as unknown[]).length
      : 0,
    potentialInventoryReduction: decimalToNumber(resultJson.potentialInventoryReduction),
    potentialAttachRate: decimalToNumber(resultJson.potentialAttachRate),
    recentExecutions,
    recommendationGroups: [...groupCounts.entries()].map(([label, value]) => ({ label, value })),
  };
}

export async function buildStoreAuditWidget(
  storeId: string,
  recommendations: ExecutiveRecommendationView[],
): Promise<CommandCenterStoreAudit> {
  const [latestResult, recentExecutions] = await Promise.all([
    prisma.aiAgentResult.findFirst({
      where: { storeId, agentId: "store_audit", isSuccess: true },
      orderBy: { createdAt: "desc" },
      select: { resultJson: true },
    }),
    prisma.aiAgentRun.count({
      where: {
        storeId,
        agentId: "store_audit",
        status: { in: ["succeeded", "cached"] },
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  const resultJson = (latestResult?.resultJson as Record<string, unknown> | undefined) ?? {};
  const auditRecommendations = recommendations.filter((item) =>
    item.subjectKey.startsWith("store-audit:"),
  );
  const openAuditRecommendations = auditRecommendations.filter((item) =>
    ["open", "viewed"].includes(item.status),
  );
  const groupCounts = new Map<string, number>();

  for (const recommendation of openAuditRecommendations) {
    groupCounts.set(recommendation.group, (groupCounts.get(recommendation.group) ?? 0) + 1);
  }

  const storeHealth = decimalToNumber(resultJson.storeHealthScore);
  const overallAuditScore = decimalToNumber(resultJson.overallAuditScore ?? resultJson.storeHealthScore);
  const homepageScore = decimalToNumber(resultJson.homepageScore);
  const seoScore = decimalToNumber(resultJson.seoScore);
  const accessibilityScore = decimalToNumber(resultJson.accessibilityScore);
  const performanceScore = decimalToNumber(resultJson.performanceScore);
  const conversionScore = decimalToNumber(resultJson.conversionScore);
  const mobileScore = decimalToNumber(resultJson.mobileScore);
  const themeScore = decimalToNumber(resultJson.themeScore);

  return {
    overallAuditScore,
    storeHealth,
    homepageScore,
    seoScore,
    accessibilityScore,
    performanceScore,
    conversionScore,
    mobileScore,
    themeScore,
    openRecommendations: openAuditRecommendations.length,
    criticalIssues: openAuditRecommendations.filter((item) => item.priority === 1).length,
    recentExecutions,
    recommendationGroups: [...groupCounts.entries()].map(([label, value]) => ({ label, value })),
    issueDistribution: [
      { label: "Homepage", value: homepageScore < 70 ? 1 : 0 },
      { label: "SEO", value: seoScore < 70 ? 1 : 0 },
      { label: "Performance", value: performanceScore < 70 ? 1 : 0 },
      { label: "Accessibility", value: accessibilityScore < 70 ? 1 : 0 },
      { label: "Conversion", value: conversionScore < 70 ? 1 : 0 },
      { label: "Mobile", value: mobileScore < 70 ? 1 : 0 },
      { label: "Images", value: decimalToNumber(resultJson.imageOptimizationScore) < 70 ? 1 : 0 },
      { label: "Trust", value: decimalToNumber(resultJson.trustScore) < 70 ? 1 : 0 },
    ],
    topFixes: openAuditRecommendations.slice(0, 5).map((item, index) => ({
      label: item.title.slice(0, 18),
      value: 5 - index,
    })),
    quickWins: openAuditRecommendations
      .filter((item) => item.group === "Quick Wins")
      .slice(0, 5)
      .map((item, index) => ({
        label: item.title.slice(0, 18),
        value: 5 - index,
      })),
    criticalIssueFeed: openAuditRecommendations
      .filter((item) => item.priority === 1)
      .slice(0, 5)
      .map((item) => ({
        id: item.id,
        title: item.title,
        category: item.category,
      })),
    healthTrend: [
      { label: "Health", value: storeHealth },
      { label: "SEO", value: seoScore },
      { label: "Performance", value: performanceScore },
    ],
    categoryBreakdown: openAuditRecommendations.reduce<ExecutiveChartPoint[]>((acc, item) => {
      const existing = acc.find((entry) => entry.label === item.category);
      if (existing) existing.value += 1;
      else acc.push({ label: item.category, value: 1 });
      return acc;
    }, []),
    seoWidgets: [
      { label: "SEO Score", value: seoScore },
      { label: "Title Coverage", value: seoScore >= 70 ? 85 : 55 },
    ],
    accessibilityWidgets: [
      { label: "Accessibility Score", value: accessibilityScore },
      { label: "Alt Coverage", value: accessibilityScore >= 70 ? 80 : 50 },
    ],
    performanceWidgets: [
      { label: "Performance Score", value: performanceScore },
      { label: "Theme Score", value: themeScore },
    ],
    auditTimeline: [
      { label: "Health", value: storeHealth },
      { label: "Homepage", value: homepageScore },
      { label: "SEO", value: seoScore },
    ],
    opportunityPipeline: [
      { label: "Critical", value: openAuditRecommendations.filter((item) => item.priority === 1).length },
      { label: "High", value: openAuditRecommendations.filter((item) => item.priority === 2).length },
      { label: "Medium", value: openAuditRecommendations.filter((item) => item.priority === 3).length },
      { label: "Low", value: openAuditRecommendations.filter((item) => item.priority >= 4).length },
    ],
  };
}

export async function buildTrendIntelligenceWidget(
  storeId: string,
  recommendations: ExecutiveRecommendationView[],
): Promise<CommandCenterTrendIntelligence> {
  const [latestResult, recentExecutions] = await Promise.all([
    prisma.aiAgentResult.findFirst({
      where: { storeId, agentId: "trend_intelligence", isSuccess: true },
      orderBy: { createdAt: "desc" },
      select: { resultJson: true },
    }),
    prisma.aiAgentRun.count({
      where: {
        storeId,
        agentId: "trend_intelligence",
        status: { in: ["succeeded", "cached"] },
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  const resultJson = (latestResult?.resultJson as Record<string, unknown> | undefined) ?? {};
  const trendRecommendations = recommendations.filter((item) => item.subjectKey.startsWith("trend:"));
  const openTrendRecommendations = trendRecommendations.filter((item) =>
    ["open", "viewed"].includes(item.status),
  );
  const groupCounts = new Map<string, number>();
  for (const recommendation of openTrendRecommendations) {
    groupCounts.set(recommendation.group, (groupCounts.get(recommendation.group) ?? 0) + 1);
  }

  const emergingProducts = Array.isArray(resultJson.emergingProducts)
    ? (resultJson.emergingProducts as unknown[])
    : [];
  const decliningProducts = Array.isArray(resultJson.decliningProducts)
    ? (resultJson.decliningProducts as unknown[])
    : [];

  return {
    trendHealth: decimalToNumber(resultJson.trendHealthScore),
    trendDirection: String(resultJson.trendDirection ?? "unknown"),
    openRecommendations: openTrendRecommendations.length,
    emergingCount: emergingProducts.length,
    decliningCount: decliningProducts.length,
    recentExecutions,
    growthAlerts: openTrendRecommendations.filter((item) =>
      ["Emerging Opportunity", "Product Momentum", "Category Momentum"].includes(item.category),
    ).length,
    declineAlerts: openTrendRecommendations.filter((item) => item.category === "Declining Demand").length,
    recommendationGroups: [...groupCounts.entries()].map(([label, value]) => ({ label, value })),
    momentumCharts: [
      { label: "Emerging", value: emergingProducts.length },
      { label: "Declining", value: decliningProducts.length },
    ],
    emergingOpportunities: emergingProducts.slice(0, 5).map((product, index) => {
      const typed = product as { title?: string; momentum?: number };
      return {
        label: typed.title?.slice(0, 18) ?? `Product ${index + 1}`,
        value: decimalToNumber(typed.momentum) * 100,
      };
    }),
    categoryOpportunities: openTrendRecommendations.slice(0, 5).map((item, index) => ({
      label: item.category.slice(0, 18),
      value: 5 - index,
    })),
    trendTimeline: [
      { label: "Health", value: decimalToNumber(resultJson.trendHealthScore) },
      { label: "Emerging", value: emergingProducts.length },
      { label: "Declining", value: decliningProducts.length },
    ],
    opportunityPipeline: [
      { label: "Critical", value: openTrendRecommendations.filter((item) => item.priority === 1).length },
      { label: "High", value: openTrendRecommendations.filter((item) => item.priority === 2).length },
      { label: "Medium", value: openTrendRecommendations.filter((item) => item.priority === 3).length },
      { label: "Low", value: openTrendRecommendations.filter((item) => item.priority >= 4).length },
    ],
  };
}

export async function buildSeoIntelligenceWidget(
  storeId: string,
  recommendations: ExecutiveRecommendationView[],
): Promise<CommandCenterSeoIntelligence> {
  const [latestResult, recentExecutions] = await Promise.all([
    prisma.aiAgentResult.findFirst({
      where: { storeId, agentId: "seo_audit", isSuccess: true },
      orderBy: { createdAt: "desc" },
      select: { resultJson: true },
    }),
    prisma.aiAgentRun.count({
      where: {
        storeId,
        agentId: "seo_audit",
        status: { in: ["succeeded", "cached"] },
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  const resultJson = (latestResult?.resultJson as Record<string, unknown> | undefined) ?? {};
  const scores = (resultJson.scores as Record<string, unknown> | undefined) ?? {};
  const seoRecommendations = recommendations.filter((item) => item.subjectKey.startsWith("seo-intelligence:"));
  const openSeoRecommendations = seoRecommendations.filter((item) => ["open", "viewed"].includes(item.status));
  const groupCounts = new Map<string, number>();

  for (const recommendation of openSeoRecommendations) {
    groupCounts.set(recommendation.group, (groupCounts.get(recommendation.group) ?? 0) + 1);
  }

  const seoHealth = decimalToNumber(resultJson.seoHealthScore);
  const searchVisibility = decimalToNumber(scores.searchVisibilityScore);
  const coreWebVitals = decimalToNumber(scores.coreWebVitalsScore);
  const technicalSeo = decimalToNumber(scores.technicalSeoScore);
  const contentQuality = decimalToNumber(scores.contentScore);
  const organicOpportunity = decimalToNumber(scores.organicOpportunityScore ?? resultJson.trafficOpportunity);

  return {
    seoHealth,
    organicOpportunity,
    searchVisibility,
    coreWebVitals,
    technicalSeo,
    contentQuality,
    openRecommendations: openSeoRecommendations.length,
    criticalIssues: openSeoRecommendations.filter((item) => item.priority === 1).length,
    recentExecutions,
    recommendationGroups: [...groupCounts.entries()].map(([label, value]) => ({ label, value })),
    seoTimeline: Array.isArray(resultJson.seoTimeline)
      ? (resultJson.seoTimeline as ExecutiveChartPoint[])
      : [
          { label: "SEO Health", value: seoHealth },
          { label: "Traffic", value: decimalToNumber(resultJson.trafficOpportunity) },
          { label: "Visibility", value: decimalToNumber(resultJson.visibilityOpportunity) },
        ],
    organicGrowth: [
      { label: "Traffic", value: decimalToNumber(resultJson.trafficOpportunity) },
      { label: "Visibility", value: decimalToNumber(resultJson.visibilityOpportunity) },
      { label: "Organic", value: organicOpportunity },
    ],
    criticalSeoFeed: openSeoRecommendations
      .filter((item) => item.priority === 1)
      .slice(0, 5)
      .map((item) => ({
        id: item.id,
        title: item.title,
        category: item.category,
      })),
    quickWins: openSeoRecommendations
      .filter((item) => item.group === "Quick Wins")
      .slice(0, 5)
      .map((item, index) => ({
        label: item.title.slice(0, 18),
        value: 5 - index,
      })),
    trendHistory: [
      { label: "Health", value: seoHealth },
      { label: "Visibility", value: searchVisibility },
      { label: "CWV", value: coreWebVitals },
    ],
    issueDistribution: openSeoRecommendations.reduce<ExecutiveChartPoint[]>((acc, item) => {
      const existing = acc.find((entry) => entry.label === item.category);
      if (existing) existing.value += 1;
      else acc.push({ label: item.category, value: 1 });
      return acc;
    }, []),
    opportunityPipeline: [
      { label: "Critical", value: openSeoRecommendations.filter((item) => item.priority === 1).length },
      { label: "High", value: openSeoRecommendations.filter((item) => item.priority === 2).length },
      { label: "Medium", value: openSeoRecommendations.filter((item) => item.priority === 3).length },
      { label: "Low", value: openSeoRecommendations.filter((item) => item.priority >= 4).length },
    ],
  };
}

export async function buildPricingIntelligenceWidget(
  storeId: string,
  recommendations: ExecutiveRecommendationView[],
): Promise<CommandCenterPricingIntelligence> {
  const [latestResult, recentExecutions] = await Promise.all([
    prisma.aiAgentResult.findFirst({
      where: { storeId, agentId: "pricing_intelligence", isSuccess: true },
      orderBy: { createdAt: "desc" },
      select: { resultJson: true },
    }),
    prisma.aiAgentRun.count({
      where: {
        storeId,
        agentId: "pricing_intelligence",
        status: { in: ["succeeded", "cached"] },
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  const resultJson = (latestResult?.resultJson as Record<string, unknown> | undefined) ?? {};
  const scores = (resultJson.scores as Record<string, unknown> | undefined) ?? {};
  const pricingRecommendations = recommendations.filter((item) =>
    item.subjectKey.startsWith("pricing-intelligence:"),
  );
  const openPricingRecommendations = pricingRecommendations.filter((item) =>
    ["open", "viewed"].includes(item.status),
  );
  const groupCounts = new Map<string, number>();
  for (const recommendation of openPricingRecommendations) {
    groupCounts.set(recommendation.group, (groupCounts.get(recommendation.group) ?? 0) + 1);
  }

  return {
    pricingHealth: decimalToNumber(resultJson.pricingHealthScore),
    marginPercent: decimalToNumber(scores.marginPercent),
    profitOpportunity: decimalToNumber(resultJson.profitOpportunity),
    revenueOpportunity: decimalToNumber(resultJson.revenueOpportunity),
    openRecommendations: openPricingRecommendations.length,
    criticalPricingRisks: openPricingRecommendations.filter((item) => item.priority === 1).length,
    recentExecutions,
    recommendationGroups: [...groupCounts.entries()].map(([label, value]) => ({ label, value })),
    pricingTimeline: Array.isArray(resultJson.pricingTimeline)
      ? (resultJson.pricingTimeline as ExecutiveChartPoint[])
      : [
          { label: "Health", value: decimalToNumber(resultJson.pricingHealthScore) },
          { label: "Revenue", value: decimalToNumber(resultJson.revenueOpportunity) },
          { label: "Profit", value: decimalToNumber(resultJson.profitOpportunity) },
        ],
    marginTrend: [
      { label: "Margin", value: decimalToNumber(scores.marginPercent) },
      { label: "Target", value: 40 },
    ],
    criticalPricingFeed: openPricingRecommendations
      .filter((item) => item.priority === 1)
      .slice(0, 5)
      .map((item) => ({
        id: item.id,
        title: item.title,
        category: item.category,
      })),
    opportunityPipeline: [
      { label: "Critical", value: openPricingRecommendations.filter((item) => item.priority === 1).length },
      { label: "High", value: openPricingRecommendations.filter((item) => item.priority === 2).length },
      { label: "Medium", value: openPricingRecommendations.filter((item) => item.priority === 3).length },
      { label: "Low", value: openPricingRecommendations.filter((item) => item.priority >= 4).length },
    ],
  };
}

export async function buildGrowthIntelligenceWidget(
  storeId: string,
  recommendations: ExecutiveRecommendationView[],
): Promise<CommandCenterGrowthIntelligence> {
  const [latestResult, recentExecutions] = await Promise.all([
    prisma.aiAgentResult.findFirst({
      where: { storeId, agentId: "growth_intelligence", isSuccess: true },
      orderBy: { createdAt: "desc" },
      select: { resultJson: true },
    }),
    prisma.aiAgentRun.count({
      where: {
        storeId,
        agentId: "growth_intelligence",
        status: { in: ["succeeded", "cached"] },
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  const resultJson = (latestResult?.resultJson as Record<string, unknown> | undefined) ?? {};
  const growthRecommendations = recommendations.filter((item) =>
    item.subjectKey.startsWith("growth-intelligence:"),
  );
  const openGrowthRecommendations = growthRecommendations.filter((item) =>
    ["open", "viewed"].includes(item.status),
  );
  const groupCounts = new Map<string, number>();
  for (const recommendation of openGrowthRecommendations) {
    groupCounts.set(recommendation.group, (groupCounts.get(recommendation.group) ?? 0) + 1);
  }

  const growthScore = decimalToNumber(resultJson.growthScore ?? resultJson.growthHealthScore);
  const monthlyRevenueOpportunity = decimalToNumber(resultJson.revenueOpportunity);
  const aovOpportunity = decimalToNumber(resultJson.aovOpportunity);

  return {
    growthScore,
    monthlyRevenueOpportunity,
    aovOpportunity,
    repeatPurchaseOpportunity: decimalToNumber(resultJson.expectedProfitLift),
    expansionReadiness: decimalToNumber(resultJson.growthHealthScore ?? growthScore),
    openRecommendations: openGrowthRecommendations.length,
    criticalGrowthRisks: openGrowthRecommendations.filter((item) => item.priority === 1).length,
    recentExecutions,
    recommendationGroups: [...groupCounts.entries()].map(([label, value]) => ({ label, value })),
    campaignTimeline: Array.isArray(resultJson.campaignTimeline)
      ? (resultJson.campaignTimeline as ExecutiveChartPoint[])
      : [
          { label: "Growth", value: growthScore },
          { label: "Revenue", value: monthlyRevenueOpportunity },
          { label: "AOV", value: aovOpportunity },
        ],
    growthTrend: [
      { label: "Growth", value: growthScore },
      { label: "Revenue Rate", value: decimalToNumber(resultJson.expectedRevenueLift) },
    ],
    criticalGrowthFeed: openGrowthRecommendations
      .filter((item) => item.priority === 1)
      .slice(0, 5)
      .map((item) => ({
        id: item.id,
        title: item.title,
        category: item.category,
      })),
    opportunityPipeline: [
      { label: "Critical", value: openGrowthRecommendations.filter((item) => item.priority === 1).length },
      { label: "High", value: openGrowthRecommendations.filter((item) => item.priority === 2).length },
      { label: "Medium", value: openGrowthRecommendations.filter((item) => item.priority === 3).length },
      { label: "Low", value: openGrowthRecommendations.filter((item) => item.priority >= 4).length },
    ],
  };
}

export async function buildExecutiveCooWidget(
  storeId: string,
  recommendations: ExecutiveRecommendationView[],
): Promise<CommandCenterExecutiveCoo> {
  const [latestResult, recentExecutions] = await Promise.all([
    prisma.aiAgentResult.findFirst({
      where: { storeId, agentId: "executive_coo", isSuccess: true },
      orderBy: { createdAt: "desc" },
      select: { resultJson: true },
    }),
    prisma.aiAgentRun.count({
      where: {
        storeId,
        agentId: "executive_coo",
        status: { in: ["succeeded", "cached"] },
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  const resultJson = (latestResult?.resultJson as Record<string, unknown> | undefined) ?? {};
  const executiveRecommendations = recommendations.filter((item) =>
    item.subjectKey.startsWith("executive-coo:"),
  );
  const openExecutiveRecommendations = executiveRecommendations.filter((item) =>
    ["open", "viewed"].includes(item.status),
  );
  const topPriorities = Array.isArray(resultJson.topPriorities)
    ? (resultJson.topPriorities as Array<{ title?: string }>)
    : [];
  const groupCounts = new Map<string, number>();
  for (const recommendation of openExecutiveRecommendations) {
    groupCounts.set(recommendation.group, (groupCounts.get(recommendation.group) ?? 0) + 1);
  }

  const businessHealth = decimalToNumber(
    resultJson.businessHealthScore ?? resultJson.operationsHealthScore,
  );

  return {
    todaysPriority: topPriorities[0]?.title ?? openExecutiveRecommendations[0]?.title ?? null,
    businessHealth,
    executiveConfidence: Math.round(decimalToNumber(resultJson.confidence) * 100),
    merchantCapacity: decimalToNumber(
      (resultJson.merchantCapacity as Record<string, unknown> | undefined)?.capacityScore,
    ),
    businessMomentum: decimalToNumber(resultJson.businessMomentum ?? businessHealth),
    criticalPathLength: openExecutiveRecommendations.filter((item) => item.priority === 1).length,
    openPriorities: openExecutiveRecommendations.length,
    blockedTasks: Array.isArray(resultJson.blockers) ? resultJson.blockers.length : 0,
    recentExecutions,
    focusAreaGroups: [...groupCounts.entries()].map(([label, value]) => ({ label, value })),
    executionTimeline: [{ label: "Run 1", value: businessHealth }],
    criticalPriorityFeed: openExecutiveRecommendations
      .filter((item) => item.priority === 1)
      .slice(0, 5)
      .map((item) => ({
        id: item.id,
        title: item.title,
        category: item.category,
      })),
    opportunityPipeline: [
      { label: "Critical", value: openExecutiveRecommendations.filter((item) => item.priority === 1).length },
      { label: "High", value: openExecutiveRecommendations.filter((item) => item.priority === 2).length },
      { label: "Medium", value: openExecutiveRecommendations.filter((item) => item.priority === 3).length },
      { label: "Low", value: openExecutiveRecommendations.filter((item) => item.priority >= 4).length },
    ],
    businessHealthTrend: [{ label: "Run 1", value: businessHealth }],
    capacityUsage: [{ label: "Capacity", value: businessHealth }],
    blockedTasksChart: openExecutiveRecommendations.slice(0, 5).map((item, index) => ({
      label: item.title.slice(0, 18),
      value: 5 - index,
    })),
  };
}

function buildCharts(executive: ExecutiveDashboardData): CommandCenterCharts {
  const revenueVsRefunds = executive.analytics.revenueTrend.map((point, index) => ({
    label: point.label,
    revenue: point.value,
    refunds: executive.analytics.refundTrend[index]?.value ?? 0,
  }));

  const recommendationCategories = Object.entries(executive.groupedRecommendations).map(
    ([label, items]) => ({
      label: label.replace(" Opportunities", "").replace(" Risks", ""),
      value: items.length,
    }),
  );

  const recommendationStatus = ["open", "viewed", "implemented", "verified", "dismissed", "closed"].map(
    (status) => ({
      label: status,
      value: executive.recommendations.filter((item) => item.status === status).length,
    }),
  );

  const openRecommendations = executive.recommendations.filter((item) =>
    ["open", "viewed"].includes(item.status),
  );

  return {
    revenueTrend: executive.analytics.revenueTrend,
    revenueVsRefunds,
    topProducts: executive.analytics.topProducts,
    bottomProducts: executive.analytics.bottomProducts,
    healthScoreHistory: executive.analytics.healthScoreHistory,
    recommendationCategories,
    inventoryAge: executive.analytics.inventoryAge,
    recommendationStatus,
    revenueOpportunityFunnel: [
      { label: "Critical", value: openRecommendations.filter((item) => item.priority === 1).length },
      { label: "High", value: openRecommendations.filter((item) => item.priority === 2).length },
      { label: "Medium", value: openRecommendations.filter((item) => item.priority === 3).length },
      { label: "Low", value: openRecommendations.filter((item) => item.priority >= 4).length },
    ],
    storeHealthBreakdown: [
      { label: "Store", value: executive.summaryCards.storeHealth },
      { label: "Revenue", value: executive.summaryCards.revenueHealth },
      { label: "Inventory", value: executive.summaryCards.inventoryHealth },
      { label: "Growth", value: executive.summaryCards.growthScore },
    ],
  };
}

export function buildAiTimeline(input: {
  runs: Array<{
    id: string;
    createdAt: Date;
    completedAt: Date | null;
    status: string;
    agentId?: string;
  }>;
  recommendations: ExecutiveRecommendationView[];
}): CommandCenterTimelineItem[] {
  const events: CommandCenterTimelineItem[] = [];

  for (const run of input.runs) {
    events.push({
      id: `timeline-run:${run.id}`,
      timeLabel: new Date(run.completedAt ?? run.createdAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      title:
        run.agentId === "inventory_intelligence"
          ? "Inventory Intelligence"
          : run.agentId === "bundle_discovery"
            ? "Bundle Discovery"
            : run.agentId === "store_audit"
              ? "Store Audit Intelligence"
              : run.agentId === "trend_intelligence"
                ? "Trend Intelligence"
                : "Product Intelligence",
      detail: run.status === "succeeded" || run.status === "cached" ? "Completed" : run.status,
      tone: run.status === "failed" || run.status === "skipped" ? "danger" : "success",
      at: (run.completedAt ?? run.createdAt).toISOString(),
    });
  }

  for (const recommendation of input.recommendations) {
    const mapping: Array<[ keyof typeof recommendation.timeline, string, CommandCenterActivityTone]> = [
      ["created", "Recommendations Generated", "info"],
      ["implemented", "Merchant Implemented Action", "warning"],
      ["verifying", "Verification Pending", "warning"],
      ["verified", "Verified", "success"],
    ];

    for (const [key, title, tone] of mapping) {
      const at = recommendation.timeline[key];
      if (!at) {
        continue;
      }

      events.push({
        id: `timeline-${recommendation.stableId}-${String(key)}`,
        timeLabel: new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        title,
        detail: recommendation.title,
        tone,
        at,
      });
    }
  }

  return events.sort((left, right) => right.at.localeCompare(left.at)).slice(0, 20);
}

function buildExecutiveDecisionsWidget(
  executive: ExecutiveDashboardData,
): CommandCenterExecutiveDecisions {
  const charts = executive.collaborationCharts;
  const summary = executive.collaborationSummary;
  const topDecision = executive.executiveDecisions[0] ?? null;

  return {
    topDecision: topDecision?.title ?? null,
    consensusScore: summary?.consensusScore ?? 0,
    conflictCount: summary?.conflictCount ?? 0,
    dependencyCount: summary?.dependencyCount ?? 0,
    topRisk: summary?.topRisk ?? null,
    topOpportunity: summary?.topOpportunity ?? null,
    decisions: executive.executiveDecisions.map((decision) => ({
      id: decision.id,
      title: decision.title,
      summary: decision.summary,
      agentsInvolved: decision.agentsInvolved,
      priority: decision.priority,
      confidence: decision.confidence,
      hasConflict: decision.hasConflict,
      hasDependency: decision.hasDependency,
      estimatedRevenueImpact: decision.estimatedRevenueImpact,
    })),
    charts: {
      consensusGauge: charts?.consensusGauge ?? [],
      agentInfluenceRadar: charts?.agentInfluenceRadar ?? [],
      dependencyGraph: charts?.dependencyGraph ?? [],
      priorityMatrixImpact: charts?.priorityMatrixImpact ?? [],
      priorityMatrixEffort: charts?.priorityMatrixEffort ?? [],
      conflictHeatmap: charts?.conflictHeatmap ?? [],
      recommendationSankey: charts?.recommendationSankey ?? [],
      decisionTimeline: charts?.decisionTimeline ?? [],
      roiWaterfall: charts?.roiWaterfall ?? [],
      healthWheel: charts?.healthWheel ?? [],
      confidenceDistribution: charts?.confidenceDistribution ?? [],
    },
  };
}

const commandCenterCache = new TimedCache<CommandCenterData>(45_000);

export async function getCommandCenterData(input: {
  storeId: string;
  currency?: string;
  merchantName?: string;
}): Promise<CommandCenterData> {
  const currency = input.currency ?? "USD";
  const cacheKey = `${input.storeId}:${currency}:${input.merchantName ?? ""}`;

  return getOrComputeCached(commandCenterCache, cacheKey, () =>
    buildCommandCenterDataUncached(input, currency),
  );
}

async function buildCommandCenterDataUncached(
  input: {
    storeId: string;
    currency?: string;
    merchantName?: string;
  },
  currency: string,
): Promise<CommandCenterData> {
  const [executive, syncStatus, usage, analyzedProducts, recentResults, recentRuns, recentInventoryRuns, recentBundleRuns, recentStoreAuditRuns, recentTrendRuns] =
    await Promise.all([
      getExecutiveDashboard(input.storeId, currency),
      getStoreSyncStatus(input.storeId),
      getAiUsageSummary(input.storeId),
      prisma.aiAgentResult.groupBy({
        by: ["subjectKey"],
        where: {
          storeId: input.storeId,
          agentId: "product_intelligence",
          isSuccess: true,
        },
      }),
      prisma.aiAgentResult.findMany({
        where: {
          storeId: input.storeId,
          agentId: "product_intelligence",
          isSuccess: true,
        },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { resultJson: true },
      }),
      prisma.aiAgentRun.findMany({
        where: { storeId: input.storeId, agentId: "product_intelligence" },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          createdAt: true,
          completedAt: true,
          status: true,
          agentId: true,
        },
      }),
      prisma.aiAgentRun.findMany({
        where: { storeId: input.storeId, agentId: "inventory_intelligence" },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          createdAt: true,
          completedAt: true,
          status: true,
          agentId: true,
        },
      }),
      prisma.aiAgentRun.findMany({
        where: { storeId: input.storeId, agentId: "bundle_discovery" },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          createdAt: true,
          completedAt: true,
          status: true,
          agentId: true,
        },
      }),
      prisma.aiAgentRun.findMany({
        where: { storeId: input.storeId, agentId: "store_audit" },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          createdAt: true,
          completedAt: true,
          status: true,
          agentId: true,
        },
      }),
      prisma.aiAgentRun.findMany({
        where: { storeId: input.storeId, agentId: "trend_intelligence" },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          createdAt: true,
          completedAt: true,
          status: true,
          agentId: true,
        },
      }),
    ]);

  const recommendations = executive.recommendations;
  const openRecommendations = recommendations.filter((item) =>
    ["open", "viewed"].includes(item.status),
  );
  const criticalIssues = openRecommendations.filter((item) => item.group === "Critical Risks").length;
  const opportunities = openRecommendations.filter(
    (item) => item.group === "Revenue Opportunities" || item.group === "Quick Wins",
  ).length;
  const potentialRevenue = openRecommendations.reduce(
    (total, item) => total + sumImpact(item.estimatedImpact),
    0,
  );
  const estimatedValueGenerated = potentialRevenue;

  const [activityFeed, agents, inventoryIntelligence, bundleDiscovery, storeAudit, trendIntelligence, seoIntelligence, pricingIntelligence, growthIntelligence, executiveCoo] =
    await Promise.all([
    buildActivityFeed({ storeId: input.storeId, currency, syncStatus }),
    buildAgentCards(input.storeId),
    buildInventoryIntelligenceWidget(input.storeId, recommendations),
    buildBundleDiscoveryWidget(input.storeId, recommendations),
    buildStoreAuditWidget(input.storeId, recommendations),
    buildTrendIntelligenceWidget(input.storeId, recommendations),
    buildSeoIntelligenceWidget(input.storeId, recommendations),
    buildPricingIntelligenceWidget(input.storeId, recommendations),
    buildGrowthIntelligenceWidget(input.storeId, recommendations),
    buildExecutiveCooWidget(input.storeId, recommendations),
  ]);

  return {
    header: {
      merchantName: input.merchantName ?? "there",
      greeting: buildGreeting(),
      storeHealth: executive.summaryCards.storeHealth,
      criticalIssues,
      opportunities,
      potentialRevenue,
    },
    briefing: buildCommandCenterBriefing({
      analyzedProducts: analyzedProducts.length,
      recommendations,
      resultSummaries: recentResults
        .map((result) => extractResultSummary(result.resultJson as Record<string, unknown>))
        .filter(Boolean),
      currency,
    }),
    activityFeed,
    agents,
    executive,
    inventoryIntelligence,
    bundleDiscovery,
    storeAudit,
    trendIntelligence,
    seoIntelligence,
    pricingIntelligence,
    growthIntelligence,
    executiveCoo,
    executiveDecisions: buildExecutiveDecisionsWidget(executive),
    healthRing: buildHealthRing({
      storeHealth: executive.summaryCards.storeHealth,
      inventoryHealth: executive.summaryCards.inventoryHealth,
      revenueHealth: executive.summaryCards.revenueHealth,
      growthScore: executive.summaryCards.growthScore,
      recommendations,
    }),
    pipeline: buildOpportunityPipeline(recommendations),
    charts: buildCharts(executive),
    aiTimeline: buildAiTimeline({
      runs: [...recentRuns, ...recentInventoryRuns, ...recentBundleRuns, ...recentStoreAuditRuns, ...recentTrendRuns],
      recommendations,
    }),
    costWidget: {
      creditsUsed: usage?.used ?? 0,
      remainingCredits: usage?.remaining ?? 0,
      creditLimit: usage?.limit ?? 0,
      estimatedValueGenerated,
    },
    currency,
  };
}

export function serializeCommandCenterForLoader(data: CommandCenterData): CommandCenterData {
  return JSON.parse(JSON.stringify(data)) as CommandCenterData;
}
