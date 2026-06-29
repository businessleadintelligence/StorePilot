import prisma from "../db.server";
import { loadUnifiedStoreMetricsForFacts } from "../ai/migration/unified-metrics-provider";
import { loadLatestCollaborationOutputFromStore } from "../ai/collaboration/collaboration-persistence";
import {
  COLLABORATION_SOURCE_AGENTS,
  type CollaborationSourceAgent,
} from "../ai/collaboration/collaboration-types";
import type { ExecutiveCooFactsSource } from "../ai/facts/executive-coo-facts";
import { calculateStoreHealthScore } from "./health-score.server";
import { getStoreMetrics } from "./metrics.server";
import { listAutomations } from "./automation.server";
import { listOperations } from "./operations.server";

const EXECUTIVE_SOURCE_AGENTS = [
  "product_intelligence",
  "inventory_intelligence",
  "bundle_discovery",
  "store_audit",
  "seo_audit",
  "pricing_intelligence",
  "growth_intelligence",
] as const;

const ESTIMATED_MARGIN_PERCENT = 42;

function buildExecutiveCooSubjectKey(storeId: string): string {
  return `executive-coo:${storeId}`;
}

function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function decimalToNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function ageHoursFromDate(createdAt: Date): number {
  return Number(((Date.now() - createdAt.getTime()) / (1000 * 60 * 60)).toFixed(2));
}

function extractHealthScore(resultJson: Record<string, unknown>): number | null {
  const score =
    resultJson.businessHealthScore ??
    resultJson.executiveHealthScore ??
    resultJson.operationsHealthScore ??
    resultJson.growthHealthScore ??
    resultJson.healthScore ??
    resultJson.pricingHealthScore ??
    resultJson.inventoryHealthScore ??
    resultJson.bundleHealthScore ??
    resultJson.storeHealthScore ??
    resultJson.seoHealthScore ??
    null;
  return score == null ? null : decimalToNumber(score);
}

function extractRiskScore(resultJson: Record<string, unknown>): number {
  const risks = Array.isArray(resultJson.risks) ? resultJson.risks.length : 0;
  const findings = Array.isArray(resultJson.findings) ? resultJson.findings.length : 0;
  const criticalFindings = Array.isArray(resultJson.findings)
    ? resultJson.findings.filter((entry) => {
        const record = entry as Record<string, unknown>;
        return record.severity === "critical" || record.severity === "high";
      }).length
    : 0;
  return Math.min(100, risks * 8 + criticalFindings * 6 + findings * 2);
}

function extractOpportunityCount(resultJson: Record<string, unknown>): number {
  if (Array.isArray(resultJson.opportunities)) return resultJson.opportunities.length;
  if (Array.isArray(resultJson.recommendations)) return resultJson.recommendations.length;
  if (Array.isArray(resultJson.topPriorities)) return resultJson.topPriorities.length;
  return 0;
}

export function createPrismaExecutiveCooFactsSource(): ExecutiveCooFactsSource {
  return {
    async getExecutiveCooSnapshot({ storeId }) {
      const thirtyDaysAgo = daysAgo(30);
      const sixtyDaysAgo = daysAgo(60);
      const ninetyDaysAgo = daysAgo(90);

      const [
        store,
        orders30,
        ordersPrev30,
        orders90,
        agentResults,
        specialistRecommendations,
        executiveRecommendations,
        collaboration,
        operations,
        automations,
        metrics,
        unifiedMetrics,
      ] = await Promise.all([
        prisma.store.findUnique({
          where: { id: storeId },
          select: { storeName: true },
        }),
        prisma.order.findMany({
          where: {
            storeId,
            cancelledAt: null,
            isTest: false,
            metricDate: { gte: thirtyDaysAgo },
          },
          select: { totalPriceAmount: true },
        }),
        prisma.order.findMany({
          where: {
            storeId,
            cancelledAt: null,
            isTest: false,
            metricDate: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
          },
          select: { totalPriceAmount: true },
        }),
        prisma.order.findMany({
          where: {
            storeId,
            cancelledAt: null,
            isTest: false,
            metricDate: { gte: ninetyDaysAgo },
          },
          select: { totalPriceAmount: true },
        }),
        Promise.all(
          EXECUTIVE_SOURCE_AGENTS.map((agentId) =>
            prisma.aiAgentResult.findFirst({
              where: { storeId, agentId, isSuccess: true },
              orderBy: { createdAt: "desc" },
              select: {
                agentId: true,
                summary: true,
                confidence: true,
                resultJson: true,
                createdAt: true,
              },
            }),
          ),
        ),
        prisma.aiRecommendation.findMany({
          where: {
            storeId,
            agentId: { in: [...COLLABORATION_SOURCE_AGENTS] },
            status: { in: ["open", "viewed", "implemented", "dismissed"] },
          },
          select: {
            agentId: true,
            title: true,
            summary: true,
            category: true,
            priority: true,
            confidence: true,
            status: true,
            stableId: true,
            payloadJson: true,
          },
        }),
        prisma.aiRecommendation.findMany({
          where: {
            storeId,
            subjectKey: buildExecutiveCooSubjectKey(storeId),
          },
          select: {
            status: true,
            stableId: true,
            payloadJson: true,
          },
        }),
        loadLatestCollaborationOutputFromStore({ storeId }),
        listOperations({ storeId }),
        listAutomations({ storeId }),
        getStoreMetrics(storeId),
        loadUnifiedStoreMetricsForFacts(storeId),
      ]);

      if (!store) {
        return null;
      }

      const storeHealthScore = calculateStoreHealthScore(metrics).score;
      const totalRevenue30 = orders30.reduce((sum, order) => sum + Number(order.totalPriceAmount ?? 0), 0);
      const previousRevenue30 = ordersPrev30.reduce((sum, order) => sum + Number(order.totalPriceAmount ?? 0), 0);
      const totalRevenue90 = orders90.reduce((sum, order) => sum + Number(order.totalPriceAmount ?? 0), 0);

      const agentSnapshots = agentResults
        .filter((record): record is NonNullable<typeof record> => record != null)
        .map((record) => {
          const resultJson = (record.resultJson as Record<string, unknown> | null) ?? {};
          const agentId = record.agentId as CollaborationSourceAgent;
          const openRecommendationCount = specialistRecommendations.filter(
            (item) =>
              item.agentId === agentId && ["open", "viewed"].includes(item.status.toLowerCase()),
          ).length;

          return {
            agentId,
            summary: record.summary,
            confidence: record.confidence == null ? null : decimalToNumber(record.confidence),
            healthScore: extractHealthScore(resultJson),
            riskScore: extractRiskScore(resultJson),
            openRecommendationCount,
            createdAt: record.createdAt.toISOString(),
            ageHours: ageHoursFromDate(record.createdAt),
          };
        });

      const mappedRecommendations = specialistRecommendations
        .filter((record) =>
          COLLABORATION_SOURCE_AGENTS.includes(record.agentId as CollaborationSourceAgent),
        )
        .map((record) => {
          const payload = (record.payloadJson as Record<string, unknown> | null) ?? {};
          return {
            recommendationId: String(payload.id ?? record.stableId),
            agentId: record.agentId as CollaborationSourceAgent,
            title: record.title,
            reason: String(payload.reason ?? record.summary),
            category: record.category,
            priority: record.priority,
            confidence: decimalToNumber(payload.confidence ?? record.confidence),
            status: record.status.toLowerCase(),
          };
        });

      const implementedPriorityIds: string[] = [];
      const dismissedPriorityIds: string[] = [];

      for (const record of executiveRecommendations) {
        const payload = (record.payloadJson as Record<string, unknown> | null) ?? {};
        const priorityId = String(payload.id ?? record.stableId);
        const status = record.status.toLowerCase();

        if (status === "implemented" || status === "verified" || status === "closed") {
          implementedPriorityIds.push(priorityId);
        }
        if (status === "dismissed") {
          dismissedPriorityIds.push(priorityId);
        }
      }

      const growthResult =
        (agentResults.find((item) => item?.agentId === "growth_intelligence")?.resultJson as
          | Record<string, unknown>
          | undefined) ?? {};
      const inventoryResult =
        (agentResults.find((item) => item?.agentId === "inventory_intelligence")?.resultJson as
          | Record<string, unknown>
          | undefined) ?? {};
      const inventorySnapshot = agentSnapshots.find((item) => item.agentId === "inventory_intelligence");
      const growthSnapshot = agentSnapshots.find((item) => item.agentId === "growth_intelligence");

      return {
        storeName: store.storeName,
        estimatedMarginPercent: ESTIMATED_MARGIN_PERCENT,
        totalRevenue30: Number(totalRevenue30.toFixed(2)),
        totalRevenue90: Number(totalRevenue90.toFixed(2)),
        previousRevenue30: Number(previousRevenue30.toFixed(2)),
        totalOrders30: orders30.length,
        storeHealthScore,
        outOfStockProducts: metrics.outOfStockProducts,
        agentSnapshots,
        specialistRecommendations: mappedRecommendations,
        implementedPriorityIds,
        dismissedPriorityIds,
        collaborationSummary: collaboration?.summary ?? null,
        collaborationConflicts:
          collaboration?.conflicts.map((conflict) => ({
            id: conflict.id,
            title: conflict.title,
            agents: conflict.agents,
            recommendations: conflict.recommendations,
            reason: conflict.reason,
            severity: conflict.severity,
            resolution: conflict.resolution,
          })) ?? [],
        collaborationDependencies:
          collaboration?.dependencies.map((dependency) => ({
            recommendationId: dependency.recommendationId,
            dependsOn: dependency.dependsOn,
            reason: dependency.reason,
          })) ?? [],
        operations: operations.map((operation) => ({
          id: operation.id,
          title: operation.title,
          status: operation.status,
          blockedReason: operation.blockedReason,
          estimatedMinutes: operation.estimatedMinutes,
          priorityScore: operation.priorityScore,
          verifiedAt: operation.verifiedAt,
        })),
        automations: automations.map((automation) => ({
          id: automation.id,
          title: automation.title,
          status: automation.status,
        })),
        merchantLearning: {
          preferredBatchSize: 3,
          averageCompletionMinutes: 45,
        },
        storeMetrics: {
          storeHealthScore,
          revenueOpportunity: decimalToNumber(
            growthResult.expectedRevenueLift ??
              growthResult.revenueOpportunity ??
              extractOpportunityCount(growthResult) * 500,
          ),
          inventoryRisk: Math.max(
            0,
            100 - decimalToNumber(inventoryResult.inventoryHealthScore ?? inventorySnapshot?.healthScore ?? 55),
          ),
          growthScore: decimalToNumber(growthResult.growthScore ?? growthSnapshot?.healthScore ?? 50),
        },
        unifiedMetrics,
      };
    },
  };
}
