import type { OutcomeDetectionRule } from "./types";

export const SIGNAL_FACT_MAP: Record<string, string[]> = {
  inventory_down: ["OutOfStock", "InventoryLow", "InventoryCritical"],
  inventory_up: ["HighInventory"],
  seo_down: ["MissingSEO", "MissingMetaDescription", "MissingAltText", "NoDescription"],
  pricing_anomaly: ["PriceAboveCategoryAverage", "PriceChanged", "MarginRiskCandidate"],
  refund_up: ["RefundRiskSeed"],
  catalog_stale: ["NeverSold", "InactiveProduct", "SlowMoving"],
  collection_issue: ["OrphanCollection", "SingleProductCollection"],
  bundle_issue: ["BundleCandidateSeed"],
};

export const PATTERN_SIGNAL_MAP: Record<string, string> = {
  high_refund_rate: "refund_up",
  inventory_pressure: "inventory_down",
  order_growth: "revenue_trend",
  revenue_decline_30d: "revenue_down",
  revenue_growth_30d: "revenue_up",
  pricing_volatility: "pricing_anomaly",
};

export const OUTCOME_DETECTION_RULES: OutcomeDetectionRule[] = [
  {
    outcome: "inventory_shortage",
    requiredSignals: ["inventory_down"],
    primaryCauseTemplate: "Inventory shortage across key variants",
    chainTemplate: [
      { stepId: "s1", label: "Inventory", domain: "inventory", evidenceIds: [] },
      { stepId: "s2", label: "Product availability", domain: "catalog", evidenceIds: [] },
    ],
  },
  {
    outcome: "revenue_decrease",
    requiredSignals: ["revenue_down"],
    optionalSignals: ["inventory_down"],
    primaryCauseTemplate: "Revenue decline correlated with operational signals",
    chainTemplate: [
      { stepId: "s1", label: "Revenue", domain: "revenue", evidenceIds: [] },
      { stepId: "s2", label: "Conversion", domain: "conversion", evidenceIds: [] },
    ],
  },
  {
    outcome: "revenue_increase",
    requiredSignals: ["revenue_up"],
    primaryCauseTemplate: "Revenue growth from recent order momentum",
    chainTemplate: [
      { stepId: "s1", label: "Revenue", domain: "revenue", evidenceIds: [] },
      { stepId: "s2", label: "Order volume", domain: "orders", evidenceIds: [] },
    ],
  },
  {
    outcome: "refund_spike",
    requiredSignals: ["refund_up"],
    primaryCauseTemplate: "Elevated refund risk signals in order history",
    chainTemplate: [
      { stepId: "s1", label: "Refunds", domain: "operations", evidenceIds: [] },
      { stepId: "s2", label: "Customer satisfaction", domain: "operations", evidenceIds: [] },
    ],
  },
  {
    outcome: "seo_degradation",
    requiredSignals: ["seo_down"],
    primaryCauseTemplate: "SEO coverage gaps reducing discoverability",
    chainTemplate: [
      { stepId: "s1", label: "SEO metadata", domain: "seo", evidenceIds: [] },
      { stepId: "s2", label: "Organic visibility", domain: "traffic", evidenceIds: [] },
    ],
  },
  {
    outcome: "traffic_loss",
    requiredSignals: ["seo_down"],
    primaryCauseTemplate: "Traffic loss linked to SEO metadata gaps",
    chainTemplate: [
      { stepId: "s1", label: "Traffic", domain: "traffic", evidenceIds: [] },
      { stepId: "s2", label: "SEO", domain: "seo", evidenceIds: [] },
      { stepId: "s3", label: "Missing metadata", domain: "seo", evidenceIds: [] },
    ],
  },
  {
    outcome: "pricing_anomaly",
    requiredSignals: ["pricing_anomaly"],
    primaryCauseTemplate: "Pricing anomalies detected against category baselines",
    chainTemplate: [
      { stepId: "s1", label: "Pricing", domain: "pricing", evidenceIds: [] },
      { stepId: "s2", label: "Margin", domain: "pricing", evidenceIds: [] },
    ],
  },
  {
    outcome: "slow_moving_products",
    requiredSignals: ["catalog_stale"],
    optionalSignals: ["inventory_up"],
    primaryCauseTemplate: "Slow-moving catalog items with weak sales velocity",
    chainTemplate: [
      { stepId: "s1", label: "Catalog velocity", domain: "catalog", evidenceIds: [] },
      { stepId: "s2", label: "Inventory turnover", domain: "inventory", evidenceIds: [] },
    ],
  },
  {
    outcome: "collection_underperformance",
    requiredSignals: ["collection_issue"],
    primaryCauseTemplate: "Collection merchandising issues reducing discovery",
    chainTemplate: [
      { stepId: "s1", label: "Collections", domain: "collections", evidenceIds: [] },
      { stepId: "s2", label: "Merchandising", domain: "catalog", evidenceIds: [] },
    ],
  },
  {
    outcome: "operational_bottleneck",
    requiredSignals: ["inventory_down", "refund_up"],
    primaryCauseTemplate: "Compound operational bottlenecks across inventory and refunds",
    chainTemplate: [
      { stepId: "s1", label: "Operations", domain: "operations", evidenceIds: [] },
      { stepId: "s2", label: "Inventory", domain: "inventory", evidenceIds: [] },
      { stepId: "s3", label: "Refunds", domain: "operations", evidenceIds: [] },
    ],
  },
];

export const CAUSAL_DOMAIN_RULES = [
  {
    id: "inventory_not_traffic_root",
    causeDomain: "inventory",
    outcomeDomain: "traffic",
    allowed: false,
    reason: "Inventory cannot directly explain traffic loss without SEO or marketing mediation",
  },
  {
    id: "pagespeed_not_refund",
    causeDomain: "performance",
    outcomeDomain: "refunds",
    allowed: false,
    reason: "Page speed cannot explain refund spikes",
  },
  {
    id: "traffic_not_inventory_root",
    causeDomain: "traffic",
    outcomeDomain: "inventory",
    allowed: false,
    reason: "Traffic loss cannot explain inventory shortage",
  },
];

export const PROFIT_MARGIN_ESTIMATE = 0.35;
