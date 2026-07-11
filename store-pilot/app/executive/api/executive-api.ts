import prisma from "../../db.server";
import type {
  BusinessContextPayload,
  DailyOperatingPlanPayload,
  DecisionCardPayload,
  ExecutiveBriefingPayload,
} from "../shared/types";

export async function getExecutiveDecisions(storeId: string, take = 50) {
  return prisma.executiveDecision.findMany({
    where: { storeId, active: true },
    orderBy: [{ rankScore: "desc" }, { urgency: "desc" }],
    take,
  });
}

export async function getOperationsQueue(storeId: string, take = 30) {
  return prisma.decisionTask.findMany({
    where: { storeId },
    orderBy: [{ createdAt: "desc" }],
    take,
    include: { decision: true },
  });
}

export async function getOperationalReadiness(storeId: string) {
  return prisma.operationalReadiness.findUnique({ where: { storeId } });
}

export async function getBusinessContext(storeId: string): Promise<BusinessContextPayload | null> {
  const snapshot = await prisma.businessContextSnapshot.findFirst({
    where: { storeId },
    orderBy: { createdAt: "desc" },
  });
  if (!snapshot) {
    return null;
  }
  return snapshot.contextJson as unknown as BusinessContextPayload;
}

export async function getExecutiveBriefing(
  storeId: string,
): Promise<ExecutiveBriefingPayload | null> {
  const dateKey = new Date().toISOString().slice(0, 10);
  const briefing = await prisma.executiveBriefing.findUnique({
    where: {
      storeId_briefingDate: { storeId, briefingDate: dateKey },
    },
  });
  if (!briefing) {
    return null;
  }
  return briefing.briefingJson as unknown as ExecutiveBriefingPayload;
}

export async function getDailyOperatingPlan(
  storeId: string,
): Promise<DailyOperatingPlanPayload | null> {
  const dateKey = new Date().toISOString().slice(0, 10);
  const plan = await prisma.dailyOperatingPlan.findUnique({
    where: {
      storeId_planDate: { storeId, planDate: dateKey },
    },
  });
  if (!plan) {
    return null;
  }
  return plan.planJson as unknown as DailyOperatingPlanPayload;
}

export async function getDecisionCards(storeId: string): Promise<DecisionCardPayload[]> {
  const decisions = await getExecutiveDecisions(storeId);
  return mapDecisionsToCards(decisions);
}

export function mapDecisionsToCards(
  decisions: Awaited<ReturnType<typeof getExecutiveDecisions>>,
): DecisionCardPayload[] {
  return decisions.slice(0, 12).map((decision) => ({
    decisionId: decision.id,
    title: decision.title,
    category: decision.category,
    severity: decision.severity,
    estimatedLossPerDay:
      Number(decision.estimatedRevenueImpact) > 0
        ? roundCurrency(Number(decision.estimatedRevenueImpact) / 30)
        : null,
    cause: decision.recommendation,
    confidencePercent: Math.round(Number(decision.confidence) * 100),
    evidenceFactTypes: extractFactTypes(decision.historicalContext),
    businessImpactLabel:
      decision.businessImpact >= 75
        ? "High"
        : decision.businessImpact >= 50
          ? "Medium"
          : "Low",
    recommendedAction: formatRecommendedAction(decision.recommendation),
  }));
}

export async function getDecisionTimeline(storeId: string) {
  return prisma.decisionHistory.findMany({
    where: { storeId },
    orderBy: { changedAt: "desc" },
    take: 50,
    include: { decision: true },
  });
}

function extractFactTypes(historicalContext: unknown): string[] {
  if (!historicalContext || typeof historicalContext !== "object") {
    return [];
  }
  const factTypes = (historicalContext as Record<string, unknown>).sourceFactTypes;
  if (!Array.isArray(factTypes)) {
    return [];
  }
  return factTypes.filter((item): item is string => typeof item === "string");
}

function formatRecommendedAction(recommendation: string): string {
  return recommendation
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}
