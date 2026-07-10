import type { z } from "zod";

import { AIPlatformError } from "../../../core/ai-errors";
import type { FoundationProviderId } from "../../types/foundation-types";
import type {
  ProviderCapability,
  ProviderCostRates,
  ProviderGenerateInput,
  ProviderGenerateResult,
  ProviderHealthStatus,
  ProviderStructuredInput,
  ProviderStructuredResult,
} from "../../types/provider-types";

abstract class StubFoundationProvider {
  abstract readonly id: FoundationProviderId;

  async generate(_input: ProviderGenerateInput): Promise<ProviderGenerateResult> {
    throw AIPlatformError.configuration(`${this.id} provider is not configured`);
  }

  async generateStructured<TSchema extends z.ZodTypeAny>(
    _input: ProviderStructuredInput<TSchema>,
  ): Promise<ProviderStructuredResult<z.infer<TSchema>>> {
    throw AIPlatformError.configuration(`${this.id} provider is not configured`);
  }

  async healthCheck(): Promise<ProviderHealthStatus> {
    return {
      providerId: this.id,
      healthy: false,
      latencyMs: 0,
      message: `${this.id} provider stub`,
    };
  }

  capability(): ProviderCapability {
    return {
      supportsStructuredOutput: false,
      supportsJsonSchema: false,
      contextWindowTokens: null,
    };
  }

  costRates(): ProviderCostRates {
    return { promptUsdPer1k: 0, completionUsdPer1k: 0 };
  }
}

export class GeminiFoundationProviderStub extends StubFoundationProvider {
  readonly id = "gemini" as const;
}

export class GrokFoundationProviderStub extends StubFoundationProvider {
  readonly id = "grok" as const;
}

export class LocalFoundationProviderStub extends StubFoundationProvider {
  readonly id = "local" as const;
}
