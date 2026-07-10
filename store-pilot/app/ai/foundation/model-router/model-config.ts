import type {
  FoundationModelTier,
  FoundationTaskCategory,
} from "../types/foundation-types";
import type { ModelTierRoute } from "../types/routing-types";

export const TASK_TIER_MAP: Record<FoundationTaskCategory, FoundationModelTier> = {
  executive_reasoning: "reasoning",
  cross_system_diagnosis: "reasoning",
  business_simulation: "reasoning",
  strategic_planning: "reasoning",
  root_cause_reasoning: "reasoning",
  report_writing: "standard",
  recommendation_generation: "standard",
  executive_summary: "standard",
  daily_report: "fast",
  short_summary: "fast",
  rewrite: "fast",
  classification: "nano",
  extraction: "nano",
  tagging: "nano",
  validation: "nano",
  json_repair: "nano",
};

export type TierModelBinding = {
  providerEnvKey: string;
  modelEnvKey: string;
  defaultProvider: string;
  defaultModel: string;
  promptUsdPer1kEnvKey: string;
  completionUsdPer1kEnvKey: string;
  defaultPromptUsdPer1k: number;
  defaultCompletionUsdPer1k: number;
};

export const TIER_MODEL_BINDINGS: Record<FoundationModelTier, TierModelBinding> = {
  reasoning: {
    providerEnvKey: "AI_TIER_REASONING_PROVIDER",
    modelEnvKey: "AI_TIER_REASONING_MODEL",
    defaultProvider: "openai",
    defaultModel: "gpt-5",
    promptUsdPer1kEnvKey: "AI_TIER_REASONING_PROMPT_USD_PER_1K",
    completionUsdPer1kEnvKey: "AI_TIER_REASONING_COMPLETION_USD_PER_1K",
    defaultPromptUsdPer1k: 0.015,
    defaultCompletionUsdPer1k: 0.06,
  },
  standard: {
    providerEnvKey: "AI_TIER_STANDARD_PROVIDER",
    modelEnvKey: "AI_TIER_STANDARD_MODEL",
    defaultProvider: "openai",
    defaultModel: "gpt-4.1",
    promptUsdPer1kEnvKey: "AI_TIER_STANDARD_PROMPT_USD_PER_1K",
    completionUsdPer1kEnvKey: "AI_TIER_STANDARD_COMPLETION_USD_PER_1K",
    defaultPromptUsdPer1k: 0.005,
    defaultCompletionUsdPer1k: 0.015,
  },
  fast: {
    providerEnvKey: "AI_TIER_FAST_PROVIDER",
    modelEnvKey: "AI_TIER_FAST_MODEL",
    defaultProvider: "openai",
    defaultModel: "gpt-4.1-mini",
    promptUsdPer1kEnvKey: "AI_TIER_FAST_PROMPT_USD_PER_1K",
    completionUsdPer1kEnvKey: "AI_TIER_FAST_COMPLETION_USD_PER_1K",
    defaultPromptUsdPer1k: 0.0004,
    defaultCompletionUsdPer1k: 0.0016,
  },
  nano: {
    providerEnvKey: "AI_TIER_NANO_PROVIDER",
    modelEnvKey: "AI_TIER_NANO_MODEL",
    defaultProvider: "openai",
    defaultModel: "gpt-4.1-nano",
    promptUsdPer1kEnvKey: "AI_TIER_NANO_PROMPT_USD_PER_1K",
    completionUsdPer1kEnvKey: "AI_TIER_NANO_COMPLETION_USD_PER_1K",
    defaultPromptUsdPer1k: 0.0001,
    defaultCompletionUsdPer1k: 0.0004,
  },
};

export function resolveTierBinding(
  tier: FoundationModelTier,
  env: NodeJS.ProcessEnv = process.env,
): ModelTierRoute {
  const binding = TIER_MODEL_BINDINGS[tier];
  const providerId = (env[binding.providerEnvKey]?.trim() ||
    binding.defaultProvider) as ModelTierRoute["providerId"];
  const modelId = env[binding.modelEnvKey]?.trim() || binding.defaultModel;

  return {
    tier,
    providerId,
    modelId,
    priority: tierPriority(tier),
  };
}

export function resolveTaskTier(
  taskCategory: FoundationTaskCategory,
): FoundationModelTier {
  return TASK_TIER_MAP[taskCategory];
}

function tierPriority(tier: FoundationModelTier): number {
  switch (tier) {
    case "reasoning":
      return 1;
    case "standard":
      return 2;
    case "fast":
      return 3;
    case "nano":
      return 4;
  }
}

export function parseEnvNumber(
  env: NodeJS.ProcessEnv,
  key: string,
  fallback: number,
): number {
  const raw = env[key]?.trim();
  if (!raw) {
    return fallback;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function resolveTierCostRates(
  tier: FoundationModelTier,
  env: NodeJS.ProcessEnv = process.env,
): { promptUsdPer1k: number; completionUsdPer1k: number } {
  const binding = TIER_MODEL_BINDINGS[tier];
  return {
    promptUsdPer1k: parseEnvNumber(
      env,
      binding.promptUsdPer1kEnvKey,
      binding.defaultPromptUsdPer1k,
    ),
    completionUsdPer1k: parseEnvNumber(
      env,
      binding.completionUsdPer1kEnvKey,
      binding.defaultCompletionUsdPer1k,
    ),
  };
}
