# Root Cause Object

Structured root cause schema. No prose in engine output.

```typescript
{
  id: string;
  causeKey: string;
  businessOutcome: BusinessOutcomeType;
  primaryCause: string;
  secondaryCauses: string[];
  contributingFactors: string[];
  confidence: number;           // 0.35–0.99 deterministic
  evidenceIds: string[];
  graphNodeIds: string[];
  businessMemoryIds: string[];
  quickWinIds: string[];
  merchantBaselineIds: string[];
  causalChain: CausalChainStep[];
  timeline: CausalTimelineEvent[];
  historicalSupport: object;
  impactEstimate: ImpactEstimate;
  severity: RootCauseSeverity;
  urgency: number;
  rankScore: number;
  generatedAt: ISO8601;
}
```

## Explanation payload (GPT input)

```typescript
{
  primaryCause: string;
  secondaryCauses: string[];
  confidence: number;
  timeline: CausalTimelineEvent[];
  evidence: Array<{ id: string }>;
  causalChain: CausalChainStep[];
  businessOutcome: BusinessOutcomeType;
}
```

GPT receives only the explanation payload — never raw Shopify data.
