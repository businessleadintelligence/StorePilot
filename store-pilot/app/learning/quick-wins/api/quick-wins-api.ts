import prisma from "../../../db.server";
import type { QuickWinUiItem, QuickWinUiSummary } from "../shared/types";

export async function getQuickWinsForStore(storeId: string) {
  return prisma.quickWin.findMany({
    where: { storeId, active: true },
    orderBy: [{ rankScore: "desc" }, { urgency: "desc" }],
  });
}

export async function getQuickWinSummary(storeId: string) {
  return prisma.quickWinSummary.findUnique({ where: { storeId } });
}

export async function getQuickWinsForUi(
  storeId: string,
  currency = "USD",
): Promise<QuickWinUiSummary | null> {
  const [wins, summary] = await Promise.all([
    getQuickWinsForStore(storeId),
    getQuickWinSummary(storeId),
  ]);

  if (wins.length === 0 && !summary) {
    return null;
  }

  const items: QuickWinUiItem[] = wins.map((win) => ({
    winType: win.winType,
    category: win.category,
    title: win.title,
    description: win.description,
    affectedCount: win.affectedCount,
    businessImpact: win.businessImpact,
    confidencePercent: Math.round(Number(win.confidence) * 100),
    revenueOpportunity: Number(win.revenueOpportunity),
    urgency: win.urgency,
  }));

  const estimatedRevenueOpportunity = summary
    ? Number(summary.estimatedRevenueOpportunity)
    : items.reduce((sum, item) => sum + item.revenueOpportunity, 0);

  return {
    headline:
      summary?.headline ??
      "StorePilot identified quick wins from your knowledge graph and evidence.",
    totalWins: summary?.totalWins ?? items.length,
    estimatedRevenueOpportunity,
    currency,
    items,
    highlights: items.slice(0, 4).map((item) => ({
      label: item.title,
      count: item.affectedCount,
    })),
    lastGeneratedAt: summary?.lastGeneratedAt?.toISOString() ?? null,
  };
}
