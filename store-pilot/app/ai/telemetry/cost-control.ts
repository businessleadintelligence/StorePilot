import { checkAiBudget, consumeAiCredits } from "../../services/ai-cost-control.server";

export type CostControlResult = {
  allowed: boolean;
  consumed: number;
  reason: string | null;
};

export async function assertAiBudgetAllowed(
  storeId: string,
  estimatedCredits = 1,
): Promise<CostControlResult> {
  const budget = await checkAiBudget(storeId, estimatedCredits);
  if (!budget.allowed) {
    return {
      allowed: false,
      consumed: 0,
      reason: budget.reason,
    };
  }

  const consumed = await consumeAiCredits(storeId, estimatedCredits);
  if (!consumed.allowed) {
    return {
      allowed: false,
      consumed: 0,
      reason: consumed.reason,
    };
  }

  return {
    allowed: true,
    consumed: consumed.consumed,
    reason: null,
  };
}
