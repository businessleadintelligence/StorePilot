import type { MemoryRepository } from "../persistence/types";

export type MemoryContext = {
  recommendations: Array<Record<string, unknown>>;
  dismissals: Array<Record<string, unknown>>;
  merchantActions: Array<Record<string, unknown>>;
  preferences: Array<Record<string, unknown>>;
};

export class AgentMemoryService {
  constructor(private readonly repository: MemoryRepository) {}

  async loadContext(input: {
    storeId: string;
    subjectKey: string;
  }): Promise<MemoryContext> {
    const [recommendations, dismissals, merchantActions, preferences] = await Promise.all([
      this.repository.list({ storeId: input.storeId, scope: "recommendation", subjectKey: input.subjectKey }),
      this.repository.list({ storeId: input.storeId, scope: "dismissal", subjectKey: input.subjectKey }),
      this.repository.list({ storeId: input.storeId, scope: "merchant_action", subjectKey: input.subjectKey }),
      this.repository.list({ storeId: input.storeId, scope: "preference", subjectKey: input.subjectKey }),
    ]);

    return {
      recommendations: recommendations.map((record) => record.payloadJson),
      dismissals: dismissals.map((record) => record.payloadJson),
      merchantActions: merchantActions.map((record) => record.payloadJson),
      preferences: preferences.map((record) => record.payloadJson),
    };
  }

  async rememberDismissal(input: {
    storeId: string;
    subjectKey: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    await this.repository.upsert({
      storeId: input.storeId,
      scope: "dismissal",
      subjectKey: input.subjectKey,
      payloadJson: input.payload,
    });
  }

  async rememberMerchantAction(input: {
    storeId: string;
    subjectKey: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    await this.repository.upsert({
      storeId: input.storeId,
      scope: "merchant_action",
      subjectKey: input.subjectKey,
      payloadJson: input.payload,
    });
  }
}

export * from "../core/ai-memory";
