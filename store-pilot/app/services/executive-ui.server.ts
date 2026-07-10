import {
  getDailyOperatingPlan,
  getDecisionCards,
  getExecutiveBriefing,
  getOperationalReadiness,
} from "../executive/api/executive-api";
import type { ExecutiveDashboardUiData } from "../executive/index";
import prisma from "../db.server";

export type { ExecutiveDashboardUiData };

export async function getExecutiveDashboardForUi(
  storeId: string,
  currency = "USD",
): Promise<ExecutiveDashboardUiData | null> {
  const [briefing, operatingPlan, decisionCards, readiness, learningReadiness] =
    await Promise.all([
      getExecutiveBriefing(storeId),
      getDailyOperatingPlan(storeId),
      getDecisionCards(storeId),
      getOperationalReadiness(storeId),
      prisma.learningReadiness.findUnique({
        where: { storeId },
        select: { executiveCooReady: true },
      }),
    ]);

  if (!briefing && !operatingPlan && decisionCards.length === 0 && !readiness) {
    return null;
  }

  return {
    briefing,
    operatingPlan,
    decisionCards,
    operationalReadinessScore: readiness?.score ?? 0,
    executiveCooReady: learningReadiness?.executiveCooReady ?? false,
    currency,
  };
}
