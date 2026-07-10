# Business DNA

Business DNA is a special `BusinessDNA` node that summarizes merchant operating characteristics. It evolves continuously as the graph grows.

## Profile Fields

| Field | Example | Derivation |
|-------|---------|------------|
| `storeType` | Fashion | businessCoverage threshold |
| `revenueStrategy` | High Volume | totalEdges > 100 |
| `pricingStrategy` | Premium | relationshipCoverage > 0.3 |
| `inventoryStyle` | Fast Moving | businessCoverage > 0.5 |
| `seoMaturityPercent` | 83 | evidenceCoverage × 100 |
| `operationalComplexity` | High | totalNodes > 500 |
| `growthStage` | Scaling | totalNodes tier |
| `aiConfidencePercent` | 94 | Weighted coverage score |

## AI Confidence Formula

```
aiConfidence = (evidenceCoverage × 0.4
              + businessCoverage × 0.35
              + relationshipCoverage × 0.25) × 100
```

## Example Node

```json
{
  "nodeType": "BusinessDNA",
  "canonicalKey": "<storeId>",
  "displayName": "Business DNA",
  "metadata": {
    "storeType": "Fashion",
    "revenueStrategy": "High Volume",
    "pricingStrategy": "Premium",
    "inventoryStyle": "Fast Moving",
    "seoMaturityPercent": 83,
    "operationalComplexity": "High",
    "growthStage": "Scaling",
    "aiConfidencePercent": 94
  }
}
```

## Update Trigger

`upsertBusinessDnaNode` runs at the end of every graph build pass after metrics are computed.

## Future: Learning Engine

Sprint 4 Learning Engine will update Business DNA based on observed outcomes, experiments, and decision results. The node structure is stable — only metadata values change.
