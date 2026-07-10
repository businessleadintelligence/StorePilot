import { describe, expect, it } from "vitest";

import {
  REQUIRED_FOUNDATION_PROMPT_IDS,
  validateFoundationPromptRegistry,
} from "../../ai/foundation/prompt-validation.server";

describe("Epic 1.3 foundation prompt registry validation", () => {
  it("1. resolves every required prompt id from disk", () => {
    const result = validateFoundationPromptRegistry();

    expect(result.ok).toBe(true);
    expect(result.missingPromptIds).toEqual([]);
    expect(REQUIRED_FOUNDATION_PROMPT_IDS).toContain("ExecutiveBriefing");
    expect(REQUIRED_FOUNDATION_PROMPT_IDS).toContain("DailyOperatingPlan");
    expect(REQUIRED_FOUNDATION_PROMPT_IDS).toContain("RootCauseExplanation");
  });
});
