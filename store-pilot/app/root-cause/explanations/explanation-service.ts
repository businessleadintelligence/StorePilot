import { z } from "zod";

import { createAIFoundationClient } from "../../ai/foundation/client";
import { buildExplanationPayload } from "./explanation-payload";
import type { RootCauseExplanationPayload, RootCauseRecord } from "../shared/types";

const RootCauseExplanationSchema = z.object({
  summary: z.string(),
  primaryCauseExplanation: z.string(),
  contributingFactorsExplanation: z.array(z.string()),
  recommendedFocus: z.string(),
});

export async function explainRootCause(input: {
  storeId: string;
  cause: RootCauseRecord;
}): Promise<{ explanation: string; generatedBy: string }> {
  const payload = buildExplanationPayload(input.cause);
  const deterministic = buildDeterministicExplanation(payload);

  if (process.env.AI_PLATFORM_ENABLED !== "true") {
    return { explanation: deterministic, generatedBy: "deterministic" };
  }

  const client = createAIFoundationClient();
  const result = await client.execute({
    promptId: "RootCauseExplanation",
    messages: [
      {
        role: "system",
        content:
          "Explain the root cause using only the structured payload. Never invent causes or metrics. Reference evidence and timeline from the payload.",
      },
      {
        role: "user",
        content: JSON.stringify(payload),
      },
    ],
    context: {
      storeId: input.storeId,
      feature: "root_cause",
      taskCategory: "root_cause_reasoning",
      agentId: "root_cause_engine",
    },
    output: {
      schema: RootCauseExplanationSchema,
      schemaName: "RootCauseExplanationOutput",
    },
  });

  if (!result.ok) {
    return { explanation: deterministic, generatedBy: "deterministic_fallback" };
  }

  return {
    explanation: `${result.data.summary} ${result.data.primaryCauseExplanation}`.trim(),
    generatedBy: "ai_foundation",
  };
}

function buildDeterministicExplanation(payload: RootCauseExplanationPayload): string {
  const chain = payload.causalChain.map((step) => step.label).join(" → ");
  return `${payload.primaryCause} (confidence ${Math.round(payload.confidence * 100)}%). Causal chain: ${chain}.`;
}
