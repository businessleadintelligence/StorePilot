export type AIContextFact = {
  key: string;
  value: unknown;
  source: string;
  computedAt?: string;
};

export type AIContext = {
  storeId: string;
  facts: AIContextFact[];
  metadata?: Record<string, string>;
};

export function createAIContext(input: {
  storeId: string;
  facts?: AIContextFact[];
  metadata?: Record<string, string>;
}): AIContext {
  return {
    storeId: input.storeId,
    facts: input.facts ?? [],
    metadata: input.metadata,
  };
}

export function factsToRecord(facts: AIContextFact[]): Record<string, unknown> {
  return Object.fromEntries(facts.map((fact) => [fact.key, fact.value]));
}

export function mergeFacts(
  base: Record<string, unknown>,
  additional: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...base,
    ...additional,
  };
}

export function buildUserPromptPayload(facts: Record<string, unknown>): string {
  return JSON.stringify(
    {
      facts,
      instructions:
        "Use only the provided facts for reasoning. Do not calculate deterministic business values.",
    },
    null,
    2,
  );
}
