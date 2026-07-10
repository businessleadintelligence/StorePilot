# Decision Model

Structured executive decision schema. No prose in engine output.

## Decision object

```typescript
{
  id: string;
  decisionKey: string;
  title: string;
  category: ExecutiveDecisionCategory;
  severity: low | medium | high | critical;
  priority: number;
  businessImpact: number;        // 0-100
  confidence: number;            // 0-1
  urgency: number;               // 0-100
  estimatedRevenueImpact: number;
  estimatedProfitImpact: number;
  estimatedEffort: number;       // 1-3
  estimatedTimeMinutes: number;
  recommendation: string;        // action key, not prose
  evidenceIds: string[];
  graphNodeIds: string[];
  relatedProducts: string[];
  relatedCollections: string[];
  relatedVendors: string[];
  businessMemoryIds: string[];
  historicalContext: object;
  sourceEngine: quick_wins | pattern_discovery | ...
  rankScore: number;
  generatedAt: ISO8601;
}
```

## Categories

support, inventory, pricing, seo, collections, operations, growth, risk, bundles, catalog, automation, performance, infrastructure, merchant_experience

## Sources

| Source engine | Origin |
|---------------|--------|
| quick_wins | Sprint 4C quick win records |
| pattern_discovery | Historical pattern seeds |
| historical_intelligence | Future direct memory rules |
| knowledge_graph | Future graph-native rules |

## Ranking formula

```
rankScore =
  businessImpact × 0.30 +
  urgency × 0.25 +
  confidence × 100 × 0.20 +
  revenueFactor × 0.15 +
  merchantPriorityBoost × 0.05 +
  readinessBoost
```

## Decision cards

UI maps decisions to cards with estimated daily loss, evidence fact types, and recommended action labels.
