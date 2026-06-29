import { z } from "zod";

import {
  BaseAIAgent,
  type AIAgentDependencies,
} from "../../core/ai-agent";
import { productRecommendationSchema } from "../../schemas";

export type TemplateAgentInput = {
  inventoryStatus: string;
  productTitle: string;
};

export class TemplateTestAgent extends BaseAIAgent<
  TemplateAgentInput,
  typeof productRecommendationSchema
> {
  readonly id = "template-test-agent";
  readonly promptId = "platform.template";
  readonly outputSchema = productRecommendationSchema;

  constructor(dependencies: AIAgentDependencies) {
    super(dependencies);
  }

  async collectFacts(input: TemplateAgentInput): Promise<Record<string, unknown>> {
    return {
      inventoryStatus: input.inventoryStatus,
      productTitle: input.productTitle,
    };
  }

  validateBusinessRules(
    facts: Record<string, unknown>,
    output: z.infer<typeof productRecommendationSchema>,
  ): void {
    if (facts.inventoryStatus === "LOW" && !output.recommendation.toLowerCase().includes("inventory")) {
      throw new Error("Low inventory recommendations must mention inventory");
    }
  }
}
