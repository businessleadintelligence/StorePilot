import { join } from "node:path";

import { listRegisteredAgents } from "../agents/agent-registry";
import { createDefaultPromptRegistry } from "./prompt-registry";
import type { PromptRegistryStore } from "./prompt-registry/registry";

export const REQUIRED_FOUNDATION_PROMPT_IDS = [
  "ExecutiveBriefing",
  "DailyOperatingPlan",
  "RootCauseExplanation",
  ...listRegisteredAgents().map((agent) => agent.promptId),
] as const;

export type PromptRegistryValidationResult = {
  ok: boolean;
  missingPromptIds: string[];
};

export function validateFoundationPromptRegistry(
  registry: PromptRegistryStore = createDefaultPromptRegistry({
    promptsDirectory: join(process.cwd(), "app", "ai", "prompts"),
  }),
): PromptRegistryValidationResult {
  const missingPromptIds: string[] = [];

  for (const promptId of REQUIRED_FOUNDATION_PROMPT_IDS) {
    if (!registry.get(promptId)) {
      missingPromptIds.push(promptId);
    }
  }

  return {
    ok: missingPromptIds.length === 0,
    missingPromptIds,
  };
}
