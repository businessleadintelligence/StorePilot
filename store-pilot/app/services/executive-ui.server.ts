import {
  getDailyOperatingPlan,
  getDecisionCards,
  getExecutiveBriefing,
  getOperationalReadiness,
  mapDecisionsToCards,
} from "../executive/api/executive-api";
import type { ExecutiveDashboardUiData } from "../executive/index";
import prisma from "../db.server";

export type { ExecutiveDashboardUiData };

export async function getExecutiveDashboardForUi(
  storeId: string,
  currency = "USD",
  options?: {
    prefetchedDecisions?: Awaited<
      ReturnType<typeof import("../executive/api/executive-api").getExecutiveDecisions>
    >;
  },
): Promise<ExecutiveDashboardUiData | null> {
  const decisionCardsPromise = options?.prefetchedDecisions
    ? Promise.resolve(mapDecisionsToCards(options.prefetchedDecisions))
    : getDecisionCards(storeId);

  const [briefing, operatingPlan, decisionCards, readiness, learningReadiness] =
    await Promise.all([
      getExecutiveBriefing(storeId),
      getDailyOperatingPlan(storeId),
      decisionCardsPromise,
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
