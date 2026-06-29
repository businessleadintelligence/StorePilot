export type FactBuilderContext = {
  storeId: string;
  merchantId?: string;
};

export interface FactBuilder<TFacts, TContext = Record<string, unknown>> {
  readonly agentId: string;
  build(context: FactBuilderContext & TContext): Promise<TFacts>;
  fingerprint(facts: TFacts): string;
}

export type MerchantContext = {
  timezone: string;
  currency: string;
  storeName?: string;
};
