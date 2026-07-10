import prisma from "../../../db.server";
import type { CostLedgerEntry, CostLedgerStore, MerchantSpendSnapshot } from "./cost-manager";
import { roundUsd } from "../utils/json";

export class PrismaCostLedgerStore implements CostLedgerStore {
  async append(entry: CostLedgerEntry): Promise<void> {
    await prisma.aiCostLedger.create({
      data: {
        id: entry.id,
        storeId: entry.storeId,
        merchantId: entry.merchantId ?? null,
        agentId: entry.agentId ?? null,
        feature: entry.feature,
        providerId: entry.providerId,
        modelId: entry.modelId,
        modelTier: entry.modelTier,
        promptTokens: entry.promptTokens,
        completionTokens: entry.completionTokens,
        totalTokens: entry.totalTokens,
        latencyMs: entry.latencyMs,
        estimatedCostUsd: entry.estimatedCostUsd,
        cacheHit: entry.cacheHit,
        success: entry.success,
        createdAt: new Date(entry.createdAt),
      },
    });
  }

  async getMerchantSnapshot(storeId: string): Promise<MerchantSpendSnapshot> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [monthlyAgg, dailyAgg, budgetRow] = await Promise.all([
      prisma.aiCostLedger.aggregate({
        where: { storeId, createdAt: { gte: monthStart } },
        _sum: { estimatedCostUsd: true },
      }),
      prisma.aiCostLedger.aggregate({
        where: { storeId, createdAt: { gte: dayStart } },
        _sum: { estimatedCostUsd: true },
      }),
      prisma.aiMerchantBudget.findUnique({ where: { storeId } }),
    ]);

    const monthlySpendUsd = Number(monthlyAgg._sum.estimatedCostUsd ?? 0);
    const dailySpendUsd = Number(dailyAgg._sum.estimatedCostUsd ?? 0);
    const monthlyBudgetUsd = Number(budgetRow?.monthlyBudgetUsd ?? 100);

    return {
      storeId,
      dailySpendUsd: roundUsd(dailySpendUsd),
      monthlySpendUsd: roundUsd(monthlySpendUsd),
      monthlyBudgetUsd,
      budgetPercentUsed: monthlyBudgetUsd
        ? Math.min(100, (monthlySpendUsd / monthlyBudgetUsd) * 100)
        : 0,
    };
  }
}

export function createPrismaCostLedgerStore(): CostLedgerStore {
  return new PrismaCostLedgerStore();
}
