import type {
  FoundationModelTier,
  FoundationProviderId,
} from "./foundation-types";

export type ModelTierRoute = {
  tier: FoundationModelTier;
  providerId: FoundationProviderId;
  modelId: string;
  priority: number;
};

export type BudgetDowngradePolicy = {
  reasoningUntilPercent: number;
  standardUntilPercent: number;
  fastUntilPercent: number;
  nanoAfterPercent: number;
};

export const DEFAULT_BUDGET_DOWNGRADE_POLICY: BudgetDowngradePolicy = {
  reasoningUntilPercent: 70,
  standardUntilPercent: 85,
  fastUntilPercent: 95,
  nanoAfterPercent: 95,
};
