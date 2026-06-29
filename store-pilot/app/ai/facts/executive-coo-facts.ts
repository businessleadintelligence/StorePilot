import { buildFactFingerprint } from "../cache/fingerprint";
import {
  COLLABORATION_SOURCE_AGENTS,
  type CollaborationSourceAgent,
} from "../collaboration/collaboration-types";
import { analyzeMerchantCapacity, analyzeExecutionCapacity } from "../tools/executive-capacity-tool";
import {
  buildBusinessHealthSummary,
  calculateExecutiveCooScores,
  type ExecutiveCooScores,
} from "../tools/executive-business-health-tool";
import { identifyBlockedTasks } from "../tools/executive-blocker-tool";
import { calculateExecutiveConfidence } from "../tools/executive-confidence-tool";
import { analyzeExecutiveConflicts } from "../tools/executive-conflict-tool";
import {
  buildExecutiveDependencyGraph,
  findDependencyBlockers,
} from "../tools/executive-dependency-tool";
import { deriveExecutiveCriticalPath } from "../tools/executive-critical-path-tool";
import { deriveExecutionOrder } from "../tools/executive-execution-order-tool";
import { calculateFocusScore } from "../tools/executive-focus-tool";
import { estimateExecutiveImpact } from "../tools/executive-impact-tool";
import { calculateOpportunityCost } from "../tools/executive-opportunity-tool";
import {
  calculateBusinessUrgency,
  calculateExecutivePriorityScore,
  deriveExecutivePriorityLevel,
} from "../tools/executive-priority-tool";
import { rankExecutivePriorities } from "../tools/executive-ranking-tool";
import {
  calculateAutomationReadiness,
  calculateExecutionReadiness,
  calculateGrowthMomentum,
} from "../tools/executive-readiness-tool";
import { analyzeResourceLoad } from "../tools/executive-resource-tool";
import { estimateExpectedRoi } from "../tools/executive-roi-tool";
import { analyzeExecutionRisk } from "../tools/executive-risk-tool";
import { buildExecutiveSummarySignals } from "../tools/executive-summary-tool";
import { buildExecutivePlanningHorizons } from "../tools/executive-timeline-tool";
import { analyzeExecutiveWorkload } from "../tools/executive-workload-tool";
import type { FactBuilder, FactBuilderContext } from "./types";

export type { ExecutiveCooScores } from "../tools/executive-business-health-tool";

export type ExecutiveCooAgentSnapshot = {
  agentId: CollaborationSourceAgent;
  summary: string | null;
  confidence: number | null;
  healthScore: number | null;
  riskScore: number;
  openRecommendationCount: number;
  createdAt: string;
  ageHours: number;
};

export type ExecutiveCooSpecialistRecommendation = {
  recommendationId: string;
  agentId: CollaborationSourceAgent;
  title: string;
  reason: string;
  category: string;
  priority: number;
  confidence: number;
  status: string;
};

export type ExecutiveCooFacts = {
  storeId: string;
  storeName: string;
  computedAt: string;
  operationsHealthScore: number;
  revenueOpportunity: number;
  inventoryRisk: number;
  growthScore: number;
  storeHealthScore: number;
  criticalIssueCount: number;
  scores: ExecutiveCooScores;
  businessUrgency: number;
  executiveConfidence: number;
  growthMomentum: number;
  executionReadiness: number;
  automationReadiness: number;
  focusScore: number;
  focusAreas: string[];
  merchantCapacity: ReturnType<typeof analyzeMerchantCapacity>;
  executionCapacity: ReturnType<typeof analyzeExecutionCapacity>;
  workload: ReturnType<typeof analyzeExecutiveWorkload>;
  resourceLoad: ReturnType<typeof analyzeResourceLoad>;
  opportunityCost: ReturnType<typeof calculateOpportunityCost>;
  executionRisk: ReturnType<typeof analyzeExecutionRisk>;
  conflicts: ReturnType<typeof analyzeExecutiveConflicts>;
  dependencyGraph: ReturnType<typeof buildExecutiveDependencyGraph>;
  criticalPath: ReturnType<typeof deriveExecutiveCriticalPath>;
  executionOrder: ReturnType<typeof deriveExecutionOrder>;
  blockers: ReturnType<typeof identifyBlockedTasks>;
  planningHorizons: ReturnType<typeof buildExecutivePlanningHorizons>;
  summarySignals: ReturnType<typeof buildExecutiveSummarySignals>;
  businessHealthSummary: ReturnType<typeof buildBusinessHealthSummary>;
  rankedPriorities: Array<{
    id: string;
    title: string;
    priorityScore: number;
    priorityLevel: number;
    confidence: number;
    revenueImpact: number;
    profitImpact: number;
    expectedRoi: number;
  }>;
  agentSnapshots: ExecutiveCooAgentSnapshot[];
  specialistRecommendations: ExecutiveCooSpecialistRecommendation[];
  knownRecommendationIds: string[];
  strategySignals: {
    alignedAgentCount: number;
    conflictingAgentCount: number;
    openSpecialistRecommendations: number;
    criticalInventoryIssues: number;
    revenueRecoveryCandidates: number;
    growthAccelerationCandidates: number;
    storeHealthGaps: number;
    immediateWinCount: number;
    strategicOpportunityCount: number;
    criticalBlockerCount: number;
    automationCandidateCount: number;
  };
  merchantOperationalPreferences: {
    prefersInventoryFirst: boolean;
    prefersRevenueRecovery: boolean;
    prefersGrowthAcceleration: boolean;
  };
  implementedPriorityIds: string[];
  dismissedPriorityIds: string[];
  collaborationSummary: string | null;
  storeTotals: {
    totalRevenue30: number;
    totalRevenue90: number;
    revenueGrowthRate: number;
    totalOrders30: number;
    openOperations: number;
    blockedOperations: number;
    openAutomations: number;
  };
};

export type ExecutiveCooFactsSource = {
  getExecutiveCooSnapshot(input: { storeId: string }): Promise<{
    storeName: string;
    estimatedMarginPercent: number;
    totalRevenue30: number;
    totalRevenue90: number;
    previousRevenue30: number;
    totalOrders30: number;
    storeHealthScore: number;
    outOfStockProducts: number;
    agentSnapshots: ExecutiveCooAgentSnapshot[];
    specialistRecommendations: ExecutiveCooSpecialistRecommendation[];
    implementedPriorityIds: string[];
    dismissedPriorityIds: string[];
    collaborationSummary: string | null;
    collaborationConflicts: Array<{
      id: string;
      title: string;
      agents: string[];
      recommendations: string[];
      reason: string;
      severity: "low" | "medium" | "high";
      resolution: string;
    }>;
    collaborationDependencies: Array<{
      recommendationId: string;
      dependsOn: string[];
      reason: string;
    }>;
    operations: Array<{
      id: string;
      title: string;
      status: string;
      blockedReason: string | null;
      estimatedMinutes: number;
      priorityScore: number;
      verifiedAt: string | null;
    }>;
    automations: Array<{ id: string; title: string; status: string }>;
    merchantLearning: {
      preferredBatchSize: number;
      averageCompletionMinutes: number;
    };
    storeMetrics: {
      storeHealthScore: number;
      revenueOpportunity: number;
      inventoryRisk: number;
      growthScore: number;
    };
  } | null>;
};

function countCriticalIssues(snapshots: ExecutiveCooAgentSnapshot[]): number {
  return snapshots.filter((snapshot) => snapshot.riskScore >= 60 || (snapshot.healthScore ?? 100) < 45).length;
}

function calculateOperationsHealthScore(snapshots: ExecutiveCooAgentSnapshot[]): number {
  if (snapshots.length === 0) return 50;

  const scores = snapshots.map((snapshot) => {
    const health = snapshot.healthScore ?? 55;
    const riskPenalty = Math.min(25, Math.round(snapshot.riskScore / 4));
    return Math.max(0, Math.min(100, health - riskPenalty));
  });

  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
}

export function createExecutiveCooFactsBuilder(
  source: ExecutiveCooFactsSource,
): FactBuilder<ExecutiveCooFacts> {
  return {
    agentId: "executive_coo",
    async build(context: FactBuilderContext): Promise<ExecutiveCooFacts> {
      const snapshot = await source.getExecutiveCooSnapshot({ storeId: context.storeId });
      if (!snapshot) {
        throw new Error("executive_coo_facts_unavailable");
      }

      const computedAt = new Date().toISOString();
      const revenueGrowthRate =
        snapshot.previousRevenue30 <= 0
          ? 0
          : Number(
              (
                ((snapshot.totalRevenue30 - snapshot.previousRevenue30) / snapshot.previousRevenue30) *
                100
              ).toFixed(2),
            );

      const operationsHealthScore = calculateOperationsHealthScore(snapshot.agentSnapshots);
      const criticalIssueCount = countCriticalIssues(snapshot.agentSnapshots);
      const openRecommendations = snapshot.specialistRecommendations.filter((item) =>
        ["open", "viewed"].includes(item.status),
      );

      const inventoryAgents = snapshot.agentSnapshots.filter((item) => item.agentId === "inventory_intelligence");
      const growthAgents = snapshot.agentSnapshots.filter((item) => item.agentId === "growth_intelligence");
      const productAgent = snapshot.agentSnapshots.find((item) => item.agentId === "product_intelligence");
      const bundleAgent = snapshot.agentSnapshots.find((item) => item.agentId === "bundle_discovery");
      const storeAuditAgent = snapshot.agentSnapshots.find((item) => item.agentId === "store_audit");
      const seoAgent = snapshot.agentSnapshots.find((item) => item.agentId === "seo_audit");
      const pricingAgent = snapshot.agentSnapshots.find((item) => item.agentId === "pricing_intelligence");

      const openOperations = snapshot.operations.filter((op) =>
        ["pending", "approved", "in_progress", "blocked", "verification"].includes(op.status),
      );
      const blockedOperations = snapshot.operations.filter((op) => op.status === "blocked");
      const inProgressOperations = snapshot.operations.filter((op) => op.status === "in_progress");
      const verifiedOperationCount = snapshot.operations.filter((op) => op.verifiedAt != null).length;

      const agentConfidences = snapshot.agentSnapshots
        .map((agent) => agent.confidence)
        .filter((value): value is number => value != null);
      const agentConfidenceAvg =
        agentConfidences.length > 0
          ? agentConfidences.reduce((sum, value) => sum + value, 0) / agentConfidences.length
          : 0.5;

      const growthMomentum = calculateGrowthMomentum({
        revenueGrowthRate,
        businessHealthScore: growthAgents[0]?.healthScore ?? null,
        implementedGrowthActions: snapshot.implementedPriorityIds.length,
        campaignReadinessProxy: growthAgents[0]?.healthScore ?? 50,
      });

      const merchantCapacity = analyzeMerchantCapacity({
        openOperations: openOperations.length,
        inProgressOperations: inProgressOperations.length,
        openRecommendations: openRecommendations.length,
        openAutomations: snapshot.automations.filter((a) => a.status !== "archived").length,
        averageCompletionMinutes: snapshot.merchantLearning.averageCompletionMinutes,
        preferredBatchSize: snapshot.merchantLearning.preferredBatchSize,
      });

      const executionCapacity = analyzeExecutionCapacity({
        merchantCapacityScore: merchantCapacity.merchantCapacityScore,
        blockedOperationCount: blockedOperations.length,
        automationReadyCount: snapshot.automations.filter((a) =>
          ["prepared", "approved", "waiting_approval"].includes(a.status),
        ).length,
        teamOwnerCount: 1,
      });

      const workload = analyzeExecutiveWorkload({
        operations: snapshot.operations.map((op) => ({
          id: op.id,
          title: op.title,
          status: op.status,
          estimatedMinutes: op.estimatedMinutes,
          priorityScore: op.priorityScore,
        })),
        recommendations: openRecommendations.map((item) => ({
          id: item.recommendationId,
          priorityScore: item.priority,
        })),
        merchantCapacityScore: merchantCapacity.merchantCapacityScore,
      });

      const resourceLoad = analyzeResourceLoad({
        inProgressOperations: inProgressOperations.length,
        pendingOperations: snapshot.operations.filter((op) => op.status === "pending").length,
        activeAutomations: snapshot.automations.filter((a) =>
          ["executing", "approved", "verifying"].includes(a.status),
        ).length,
        merchantCapacityScore: merchantCapacity.merchantCapacityScore,
        parallelWorkstreams: executionCapacity.parallelWorkstreams,
      });

      const conflicts = analyzeExecutiveConflicts({
        collaborationConflicts: snapshot.collaborationConflicts,
        competingPriorities: openRecommendations.map((item) => ({
          id: item.recommendationId,
          category: item.category,
          priorityScore: item.priority,
        })),
      });

      const dependencyNodes = openRecommendations.map((item) => ({
        id: item.recommendationId,
        label: item.title,
        agentId: item.agentId,
        dependsOn: snapshot.collaborationDependencies
          .filter((dep) => dep.recommendationId === item.recommendationId)
          .flatMap((dep) => dep.dependsOn),
      }));

      const dependencyGraph = buildExecutiveDependencyGraph({
        nodes: dependencyNodes,
        collaborationDependencies: snapshot.collaborationDependencies,
      });

      const dependencyBlockedIds = findDependencyBlockers(
        dependencyGraph,
        new Set(snapshot.implementedPriorityIds),
      );

      const scoredPriorities = openRecommendations.map((item) => {
        const priorityScore = calculateExecutivePriorityScore({
          confidence: item.confidence,
          difficulty: "Medium",
          revenueImpact: snapshot.storeMetrics.revenueOpportunity / Math.max(1, openRecommendations.length),
          profitImpact: snapshot.storeMetrics.revenueOpportunity * 0.35,
          urgencySignals: item.priority <= 2 ? 2 : 0,
          blocked: dependencyBlockedIds.includes(item.recommendationId),
          dismissed: snapshot.dismissedPriorityIds.includes(item.recommendationId),
          agentWeight: 1,
        });

        const impact = estimateExecutiveImpact({
          baseRevenue30: snapshot.totalRevenue30,
          marginPercent: snapshot.estimatedMarginPercent,
          revenueOpportunity: snapshot.storeMetrics.revenueOpportunity,
          profitOpportunity: snapshot.storeMetrics.revenueOpportunity * 0.35,
          priorityScore,
          confidence: item.confidence,
        });

        const roi = estimateExpectedRoi({
          revenueImpact: impact.revenueImpact,
          profitImpact: impact.profitImpact,
          implementationMinutes: 60,
          difficulty: "Medium",
          confidence: item.confidence,
        });

        return {
          id: item.recommendationId,
          title: item.title,
          priorityScore,
          priorityLevel: deriveExecutivePriorityLevel(priorityScore),
          confidence: item.confidence,
          revenueImpact: impact.revenueImpact,
          profitImpact: impact.profitImpact,
          expectedRoi: roi.expectedRoi,
          dependsOn: dependencyNodes.find((node) => node.id === item.recommendationId)?.dependsOn ?? [],
          estimatedMinutes: 60,
        };
      });

      const rankedPriorities = rankExecutivePriorities(scoredPriorities);

      const executionOrder = deriveExecutionOrder({
        items: rankedPriorities.map((item) => ({
          id: item.id,
          priorityScore: item.priorityScore,
          dependsOn: item.dependsOn,
          blockedBy: dependencyBlockedIds.includes(item.id) ? ["dependency"] : [],
          estimatedMinutes: item.estimatedMinutes,
        })),
      });

      const criticalPath = deriveExecutiveCriticalPath({
        items: rankedPriorities.map((item) => ({
          id: item.id,
          title: item.title,
          priorityScore: item.priorityScore,
          estimatedMinutes: item.estimatedMinutes,
          dependsOn: item.dependsOn,
        })),
        blockedIds: new Set(executionOrder.blockedItems),
      });

      const blockers = identifyBlockedTasks({
        operations: snapshot.operations,
        dependencyBlockedIds,
        conflictBlockedIds: conflicts.conflicts.flatMap((conflict) => conflict.recommendationIds),
        capacityBlocked: merchantCapacity.overloadRisk === "high",
      });

      const businessUrgency = calculateBusinessUrgency({
        blockedOperationCount: blockedOperations.length,
        outOfStockProducts: snapshot.outOfStockProducts,
        revenueGrowthRate,
        criticalRiskCount: blockers.criticalBlockerCount,
        openHighPriorityCount: rankedPriorities.filter((item) => item.priorityLevel <= 2).length,
      });

      const scores = calculateExecutiveCooScores({
        storeHealthScore: snapshot.storeHealthScore,
        productHealthScore: productAgent?.healthScore ?? null,
        inventoryHealthScore: inventoryAgents[0]?.healthScore ?? null,
        bundleHealthScore: bundleAgent?.healthScore ?? null,
        storeAuditScore: storeAuditAgent?.healthScore ?? null,
        seoHealthScore: seoAgent?.healthScore ?? null,
        pricingHealthScore: pricingAgent?.healthScore ?? null,
        growthHealthScore: growthAgents[0]?.healthScore ?? null,
        revenueGrowthRate,
        orderCount: snapshot.totalOrders30,
        openOperationCount: openOperations.length,
        blockedOperationCount: blockedOperations.length,
        openRecommendationCount: openRecommendations.length,
        agentConfidenceAvg,
        implementedActionCount: snapshot.implementedPriorityIds.length,
        verifiedOperationCount,
        growthMomentum,
      });

      const businessHealthSummary = buildBusinessHealthSummary({
        scores,
        criticalBlockerCount: blockers.criticalBlockerCount,
      });

      const executiveConfidenceResult = calculateExecutiveConfidence({
        agentConfidences,
        dataFreshnessHours: snapshot.agentSnapshots.map((agent) => agent.ageHours),
        evidenceCount: rankedPriorities.length * 2,
        conflictCount: conflicts.conflicts.length,
        implementedActionCount: snapshot.implementedPriorityIds.length,
      });

      const executionRisk = analyzeExecutionRisk({
        blockedOperationCount: blockedOperations.length,
        overdueOperationCount: 0,
        conflictScore: conflicts.conflictScore,
        inventoryRiskScore: snapshot.storeMetrics.inventoryRisk,
        pricingRiskScore: pricingAgent?.riskScore ?? 0,
        revenueGrowthRate,
        outOfStockProducts: snapshot.outOfStockProducts,
      });

      const executionReadinessResult = calculateExecutionReadiness({
        merchantCapacityScore: merchantCapacity.merchantCapacityScore,
        executionCapacityScore: executionCapacity.executionCapacityScore,
        blockedOperationCount: blockedOperations.length,
        criticalBlockerCount: blockers.criticalBlockerCount,
        executionRiskScore: executionRisk.executionRiskScore,
      });

      const automationReadinessResult = calculateAutomationReadiness({
        automationReadyCount: snapshot.automations.filter((a) =>
          ["prepared", "approved", "waiting_approval"].includes(a.status),
        ).length,
        activeAutomations: snapshot.automations.filter((a) =>
          ["executing", "approved", "verifying"].includes(a.status),
        ).length,
        verifiedOperationCount,
        executionReadiness: executionReadinessResult.executionReadiness,
        repeatableOperationCount: snapshot.operations.filter((op) => op.status === "verified").length,
      });

      const opportunityCost = calculateOpportunityCost({
        deferredRevenueImpact: rankedPriorities.slice(3).reduce((sum, item) => sum + item.revenueImpact, 0),
        deferredProfitImpact: rankedPriorities.slice(3).reduce((sum, item) => sum + item.profitImpact, 0),
        blockedOperationCount: blockedOperations.length,
        conflictCount: conflicts.conflicts.length,
        daysDelayed: blockers.criticalBlockerCount > 0 ? 7 : 3,
      });

      const focus = calculateFocusScore({
        topPriorityScores: rankedPriorities.slice(0, 5).map((item) => item.priorityScore),
        conflictScore: conflicts.conflictScore,
        workloadScore: workload.workloadScore,
        merchantCapacityScore: merchantCapacity.merchantCapacityScore,
        focusAreaCount: new Set(openRecommendations.map((item) => item.category)).size,
      });

      const planningHorizons = buildExecutivePlanningHorizons({
        computedAt,
        topPriorityIds: rankedPriorities.map((item) => item.id),
        weeklyFocusIds: rankedPriorities.filter((item) => item.priorityLevel <= 3).map((item) => item.id),
        monthlyObjectiveIds: rankedPriorities.map((item) => item.id),
      });

      const summarySignals = buildExecutiveSummarySignals({
        scores,
        businessUrgency,
        executiveConfidence: executiveConfidenceResult.executiveConfidence,
        topPriorityTitles: rankedPriorities.slice(0, 3).map((item) => item.title),
        blockerCount: blockers.blockedTaskCount,
        opportunityCostScore: opportunityCost.opportunityCostScore,
      });

      const strategySignals = {
        alignedAgentCount: snapshot.agentSnapshots.filter((item) => (item.healthScore ?? 0) >= 65).length,
        conflictingAgentCount: snapshot.agentSnapshots.filter((item) => item.riskScore >= 70).length,
        openSpecialistRecommendations: openRecommendations.length,
        criticalInventoryIssues: inventoryAgents.filter((item) => (item.healthScore ?? 100) < 50).length,
        revenueRecoveryCandidates: openRecommendations.filter(
          (item) =>
            item.agentId === "pricing_intelligence" ||
            item.agentId === "product_intelligence" ||
            item.category.toLowerCase().includes("revenue"),
        ).length,
        growthAccelerationCandidates: openRecommendations.filter((item) => item.agentId === "growth_intelligence")
          .length,
        storeHealthGaps: snapshot.agentSnapshots.filter((item) => item.agentId === "store_audit").length,
        immediateWinCount: rankedPriorities.filter((item) => item.priorityScore >= 75).length,
        strategicOpportunityCount: rankedPriorities.filter((item) => item.priorityLevel >= 4).length,
        criticalBlockerCount: blockers.criticalBlockerCount,
        automationCandidateCount: automationReadinessResult.automatableCandidates,
      };

      const merchantOperationalPreferences = {
        prefersInventoryFirst:
          strategySignals.criticalInventoryIssues > 0 ||
          snapshot.storeMetrics.inventoryRisk >= 60 ||
          inventoryAgents.some((item) => (item.healthScore ?? 100) < 55),
        prefersRevenueRecovery:
          strategySignals.revenueRecoveryCandidates >= strategySignals.growthAccelerationCandidates,
        prefersGrowthAcceleration:
          growthAgents.some((item) => (item.healthScore ?? 0) >= 65) &&
          snapshot.storeMetrics.growthScore >= 55,
      };

      return {
        storeId: context.storeId,
        storeName: snapshot.storeName,
        computedAt,
        operationsHealthScore,
        revenueOpportunity: snapshot.storeMetrics.revenueOpportunity,
        inventoryRisk: snapshot.storeMetrics.inventoryRisk,
        growthScore: snapshot.storeMetrics.growthScore,
        storeHealthScore: snapshot.storeHealthScore,
        criticalIssueCount,
        scores,
        businessUrgency,
        executiveConfidence: executiveConfidenceResult.executiveConfidence,
        growthMomentum,
        executionReadiness: executionReadinessResult.executionReadiness,
        automationReadiness: automationReadinessResult.automationReadiness,
        focusScore: focus.focusScore,
        focusAreas: focus.focusAreas,
        merchantCapacity,
        executionCapacity,
        workload,
        resourceLoad,
        opportunityCost,
        executionRisk,
        conflicts,
        dependencyGraph,
        criticalPath,
        executionOrder,
        blockers,
        planningHorizons,
        summarySignals,
        businessHealthSummary,
        rankedPriorities,
        agentSnapshots: snapshot.agentSnapshots,
        specialistRecommendations: snapshot.specialistRecommendations,
        knownRecommendationIds: snapshot.specialistRecommendations.map((item) => item.recommendationId),
        strategySignals,
        merchantOperationalPreferences,
        implementedPriorityIds: snapshot.implementedPriorityIds,
        dismissedPriorityIds: snapshot.dismissedPriorityIds,
        collaborationSummary: snapshot.collaborationSummary,
        storeTotals: {
          totalRevenue30: snapshot.totalRevenue30,
          totalRevenue90: snapshot.totalRevenue90,
          revenueGrowthRate,
          totalOrders30: snapshot.totalOrders30,
          openOperations: openOperations.length,
          blockedOperations: blockedOperations.length,
          openAutomations: snapshot.automations.filter((a) => a.status !== "archived").length,
        },
      };
    },
    fingerprint(facts: ExecutiveCooFacts) {
      return buildFactFingerprint({
        storeId: facts.storeId,
        operationsHealthScore: facts.operationsHealthScore,
        recommendationCount: facts.specialistRecommendations.length,
        agentCount: facts.agentSnapshots.length,
        computedAt: facts.computedAt,
      });
    },
  };
}

export { COLLABORATION_SOURCE_AGENTS };
