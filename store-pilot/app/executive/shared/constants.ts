import type { ExecutiveDecisionSeverity, QuickWinType } from "@prisma/client";
import type { PatternToDecisionMapping, QuickWinToDecisionMapping } from "./types";

export function severityFromUrgency(urgency: number): ExecutiveDecisionSeverity {
  if (urgency >= 80) {
    return "critical";
  }
  if (urgency >= 60) {
    return "high";
  }
  if (urgency >= 35) {
    return "medium";
  }
  return "low";
}

export const QUICK_WIN_DECISION_MAP: QuickWinToDecisionMapping[] = [
  {
    winType: "missing_seo",
    category: "seo",
    recommendation: "optimize_seo_titles",
    severityFromUrgency: severityFromUrgency,
  },
  {
    winType: "missing_meta_description",
    category: "seo",
    recommendation: "add_meta_descriptions",
    severityFromUrgency: severityFromUrgency,
  },
  {
    winType: "missing_alt_text",
    category: "seo",
    recommendation: "add_image_alt_text",
    severityFromUrgency: severityFromUrgency,
  },
  {
    winType: "no_description",
    category: "seo",
    recommendation: "add_product_descriptions",
    severityFromUrgency: severityFromUrgency,
  },
  {
    winType: "low_stock",
    category: "inventory",
    recommendation: "restock_low_inventory",
    severityFromUrgency: severityFromUrgency,
  },
  {
    winType: "out_of_stock",
    category: "inventory",
    recommendation: "resolve_out_of_stock",
    severityFromUrgency: severityFromUrgency,
  },
  {
    winType: "inventory_risk",
    category: "risk",
    recommendation: "mitigate_inventory_risk",
    severityFromUrgency: severityFromUrgency,
  },
  {
    winType: "overstock",
    category: "inventory",
    recommendation: "reduce_overstock",
    severityFromUrgency: severityFromUrgency,
  },
  {
    winType: "pricing_outlier",
    category: "pricing",
    recommendation: "review_pricing_outliers",
    severityFromUrgency: severityFromUrgency,
  },
  {
    winType: "margin_risk",
    category: "pricing",
    recommendation: "review_margin_risk",
    severityFromUrgency: severityFromUrgency,
  },
  {
    winType: "bundle_candidate",
    category: "bundles",
    recommendation: "create_product_bundle",
    severityFromUrgency: severityFromUrgency,
  },
  {
    winType: "collection_issue",
    category: "collections",
    recommendation: "fix_collection_merchandising",
    severityFromUrgency: severityFromUrgency,
  },
  {
    winType: "never_sold_product",
    category: "catalog",
    recommendation: "promote_never_sold_products",
    severityFromUrgency: severityFromUrgency,
  },
  {
    winType: "dead_product",
    category: "catalog",
    recommendation: "archive_dead_products",
    severityFromUrgency: severityFromUrgency,
  },
  {
    winType: "slow_moving_product",
    category: "catalog",
    recommendation: "clear_slow_moving_inventory",
    severityFromUrgency: severityFromUrgency,
  },
  {
    winType: "inactive_product",
    category: "catalog",
    recommendation: "review_inactive_products",
    severityFromUrgency: severityFromUrgency,
  },
  {
    winType: "draft_too_long",
    category: "catalog",
    recommendation: "publish_stale_drafts",
    severityFromUrgency: severityFromUrgency,
  },
  {
    winType: "no_images",
    category: "catalog",
    recommendation: "improve_product_media",
    severityFromUrgency: severityFromUrgency,
  },
  {
    winType: "high_refund_risk",
    category: "operations",
    recommendation: "investigate_refund_risk",
    severityFromUrgency: severityFromUrgency,
  },
];

export const PATTERN_DECISION_MAP: PatternToDecisionMapping[] = [
  {
    patternType: "weekend_sales_lift",
    category: "growth",
    title: () => "Weekend sales lift detected",
    recommendation: "capitalize_weekend_demand",
  },
  {
    patternType: "high_refund_rate",
    category: "risk",
    title: () => "Elevated refund rate pattern",
    recommendation: "reduce_refund_rate",
  },
  {
    patternType: "inventory_pressure",
    category: "inventory",
    title: () => "Inventory pressure pattern",
    recommendation: "stabilize_inventory_levels",
  },
  {
    patternType: "seasonal_candidate",
    category: "growth",
    title: () => "Seasonal product candidates",
    recommendation: "plan_seasonal_campaign",
  },
  {
    patternType: "pricing_volatility",
    category: "pricing",
    title: () => "Pricing volatility detected",
    recommendation: "stabilize_pricing_strategy",
  },
  {
    patternType: "category_concentration",
    category: "risk",
    title: () => "Revenue concentration risk",
    recommendation: "diversify_revenue_concentration",
  },
  {
    patternType: "order_growth",
    category: "growth",
    title: (label) =>
      label.includes("decline") ? "Revenue decline pattern" : "Revenue growth pattern",
    recommendation: "respond_to_revenue_trend",
  },
];

export function getQuickWinDecisionMapping(
  winType: QuickWinType,
): QuickWinToDecisionMapping | undefined {
  return QUICK_WIN_DECISION_MAP.find((mapping) => mapping.winType === winType);
}

export const PROFIT_MARGIN_ESTIMATE = 0.35;

export const OPERATIONAL_READINESS_WEIGHTS = {
  inventory: 0.15,
  pricing: 0.12,
  seo: 0.1,
  collections: 0.08,
  automation: 0.08,
  operationalRisk: 0.12,
  executionCapacity: 0.1,
  knowledgeConfidence: 0.12,
  historicalStability: 0.08,
  predictionReadiness: 0.05,
} as const;
