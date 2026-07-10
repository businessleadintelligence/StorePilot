# Quick Win Scoring

Deterministic scoring for Sprint 4C quick wins. All inputs come from evidence confidence, affected counts, category weights, and merchant revenue baselines.

## Dimensions

Every quick win includes:

| Dimension | Range | Source |
|-----------|-------|--------|
| Business Impact | 10–100 | Affected count × category impact weight |
| Estimated Effort | 1–3 | Win definition (low=1, medium=2, high=3) |
| Confidence | 0.35–0.99 | Average evidence confidence for source facts |
| Revenue Opportunity | $0+ | AOV × affected count × category multiplier × impact weight |
| Urgency | 5–100 | Base urgency boost + count scaling |
| Category | enum | inventory, seo, pricing, catalog, collections, operations |

## Business impact

```
countFactor = min(100, log10(affectedCount + 1) × 35)
businessImpact = round(clamp(countFactor × impactWeight, 10, 100))
```

Higher affected counts increase impact logarithmically to avoid runaway scores on large catalogs.

## Revenue opportunity

```
perItemOpportunity = averageOrderValue × 0.08 × categoryMultiplier
revenueOpportunity = min(
  affectedCount × perItemOpportunity × impactWeight,
  averageOrderValue × affectedCount × 2
)
```

Category multipliers:

| Category | Multiplier |
|----------|------------|
| inventory | 1.2 |
| pricing | 1.0 |
| operations | 0.9 |
| seo | 0.6 |
| catalog | 0.5 |
| collections | 0.4 |

AOV is loaded from the `revenue` merchant baseline when available; otherwise defaults to $75.

## Rank score

```
effortPenalty = (effort - 1) × 8
revenueFactor = min(30, revenueOpportunity / 50)

rankScore =
  businessImpact × 0.35 +
  urgency × 0.25 +
  confidence × 100 × 0.20 +
  revenueFactor × 0.15 -
  effortPenalty × 0.05
```

## Trial prioritization

After ranking, wins are re-sorted for trial display using category priority:

1. inventory
2. pricing
3. seo
4. catalog
5. collections
6. operations

Within each category, higher rank score wins appear first.

## Trial highlights

Dashboard headline highlights prioritize:

1. missing_seo
2. inventory_risk
3. pricing_outlier
4. bundle_candidate

Then fills remaining slots from top-ranked wins.

## Source evidence

Each persisted win stores:

- `evidenceIds` — up to 50 supporting evidence row IDs
- `sourceFactTypes` — fact types used for detection

Agents and merchants can trace every win back to graph evidence.
