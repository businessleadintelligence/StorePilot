import type { BusinessOutcomeType } from "@prisma/client";

import prisma from "../../db.server";
import { getStoredBusinessTimeline } from "../engine/root-cause-engine";
import type { RootCauseUiItem } from "../shared/types";

export async function getRootCauses(storeId: string) {
  return prisma.rootCause.findMany({
    where: { storeId, active: true },
    orderBy: [{ rankScore: "desc" }],
    take: 20,
  });
}

export async function getRootCauseTimeline(storeId: string) {
  return prisma.causalTimeline.findMany({
    where: { storeId },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { rootCause: true },
  });
}

export async function getSignalCorrelations(storeId: string) {
  return prisma.signalCorrelation.findMany({
    where: { storeId },
    orderBy: { computedAt: "desc" },
    take: 50,
  });
}

export async function getCauseConfidence(storeId: string) {
  return prisma.causeConfidence.findMany({
    where: { storeId },
    orderBy: { computedAt: "desc" },
    take: 50,
    include: { rootCause: true },
  });
}

export async function getCausalGraph(storeId: string) {
  return prisma.causalGraphEdge.findMany({
    where: { storeId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function getBusinessTimeline(storeId: string) {
  return getStoredBusinessTimeline(storeId);
}

async function getOutcomeExplanation(
  storeId: string,
  outcome: BusinessOutcomeType,
) {
  return prisma.rootCause.findFirst({
    where: { storeId, active: true, businessOutcome: outcome },
    orderBy: { rankScore: "desc" },
  });
}

export const getRevenueExplanation = (storeId: string) =>
  getOutcomeExplanation(storeId, "revenue_decrease");

export const getConversionExplanation = (storeId: string) =>
  getOutcomeExplanation(storeId, "conversion_decrease");

export const getInventoryExplanation = (storeId: string) =>
  getOutcomeExplanation(storeId, "inventory_shortage");

export const getTrafficExplanation = (storeId: string) =>
  getOutcomeExplanation(storeId, "traffic_loss");

export async function getRootCauseUiItems(storeId: string): Promise<RootCauseUiItem[]> {
  const causes = await getRootCauses(storeId);
  return mapRootCauseUiItemsFromRows(causes);
}

export function mapRootCauseUiItemsFromRows(
  causes: Awaited<ReturnType<typeof getRootCauses>>,
): RootCauseUiItem[] {
  return causes.slice(0, 8).map((cause) => ({
    id: cause.id,
    businessOutcome: cause.businessOutcome,
    primaryCause: cause.primaryCause,
    confidencePercent: Math.round(Number(cause.confidence) * 100),
    severity: cause.severity,
    revenueImpact: parseImpactEstimate(cause.impactEstimate).revenueImpact,
    evidenceCount: Array.isArray(cause.evidenceIds) ? cause.evidenceIds.length : 0,
    timelineLength: Array.isArray(cause.timeline) ? cause.timeline.length : 0,
  }));
}

function parseImpactEstimate(value: unknown): { revenueImpact: number } {
  if (!value || typeof value !== "object") {
    return { revenueImpact: 0 };
  }
  const revenueImpact = (value as Record<string, unknown>).revenueImpact;
  return {
    revenueImpact: typeof revenueImpact === "number" ? revenueImpact : 0,
  };
}
