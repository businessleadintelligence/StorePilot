import type { FoundationModelTier } from "../types/foundation-types";
import type {
  BudgetDowngradePolicy,
  ModelTierRoute,
} from "../types/routing-types";
import { DEFAULT_BUDGET_DOWNGRADE_POLICY } from "../types/routing-types";
import { resolveTaskTier, resolveTierBinding } from "./model-config";

export type ModelRouteInput = {
  taskCategory: Parameters<typeof resolveTaskTier>[0];
  monthlyBudgetUsd: number;
  monthlySpendUsd: number;
  policy?: BudgetDowngradePolicy;
  env?: NodeJS.ProcessEnv;
};

export type ModelRouteResult = {
  requestedTier: FoundationModelTier;
  resolvedTier: FoundationModelTier;
  route: ModelTierRoute;
  downgraded: boolean;
  budgetPercentUsed: number;
};

export function resolveModelRoute(input: ModelRouteInput): ModelRouteResult {
  const policy = input.policy ?? DEFAULT_BUDGET_DOWNGRADE_POLICY;
  const requestedTier = resolveTaskTier(input.taskCategory);
  const budgetPercentUsed = calculateBudgetPercentUsed(
    input.monthlySpendUsd,
    input.monthlyBudgetUsd,
  );
  const resolvedTier = applyBudgetDowngrade(requestedTier, budgetPercentUsed, policy);
  const route = resolveTierBinding(resolvedTier, input.env);

  return {
    requestedTier,
    resolvedTier,
    route,
    downgraded: resolvedTier !== requestedTier,
    budgetPercentUsed,
  };
}

export function applyBudgetDowngrade(
  requestedTier: FoundationModelTier,
  budgetPercentUsed: number,
  policy: BudgetDowngradePolicy = DEFAULT_BUDGET_DOWNGRADE_POLICY,
): FoundationModelTier {
  if (budgetPercentUsed >= policy.nanoAfterPercent) {
    return "nano";
  }

  if (budgetPercentUsed >= policy.fastUntilPercent) {
    return downgradeOne(requestedTier, 2);
  }

  if (budgetPercentUsed >= policy.standardUntilPercent) {
    return downgradeOne(requestedTier, 1);
  }

  if (budgetPercentUsed >= policy.reasoningUntilPercent) {
    if (requestedTier === "reasoning") {
      return "standard";
    }
  }

  return requestedTier;
}

function downgradeOne(
  tier: FoundationModelTier,
  steps: number,
): FoundationModelTier {
  const order: FoundationModelTier[] = [
    "reasoning",
    "standard",
    "fast",
    "nano",
  ];
  const index = order.indexOf(tier);
  return order[Math.min(order.length - 1, index + steps)];
}

function calculateBudgetPercentUsed(spent: number, budget: number): number {
  if (budget <= 0) {
    return spent > 0 ? 100 : 0;
  }
  return Math.min(100, (Math.max(0, spent) / budget) * 100);
}
