import type { PredictionDefinition } from "./types";

export const BUSINESS_STABILITY_WEIGHTS = {
  forecastVolatility: 0.18,
  inventoryRisk: 0.18,
  revenueStability: 0.18,
  supplierReliability: 0.12,
  seasonalUncertainty: 0.1,
  pricingStability: 0.12,
  trafficConsistency: 0.12,
} as const;

export const FORECAST_WINDOW_DAYS: Record<string, number> = {
  days_4: 4,
  days_7: 7,
  days_12: 12,
  days_30: 30,
  next_week: 7,
};

export const PREDICTION_DEFINITIONS: PredictionDefinition[] = [
  {
    predictionType: "inventory_stockout",
    predictionKey: "forecast:inventory_stockout",
    title: "Likely stockout",
    requiredSignals: ["inventory_down"],
    forecastWindow: "days_4",
    buildOutcome: ({ context }) => {
      const lowStock = countEvidence(context, ["InventoryLow", "InventoryCritical", "OutOfStock"]);
      const days = Math.max(2, 6 - Math.min(4, lowStock));
      return {
        predictedOutcome: `Stockout in ${days} days`,
        predictedValue: days,
        predictedUnit: "days",
        description: `${lowStock} inventory risk signals indicate likely stockout`,
      };
    },
  },
  {
    predictionType: "revenue_forecast",
    predictionKey: "forecast:revenue_change",
    title: "Revenue forecast",
    requiredSignals: ["revenue_down"],
    forecastWindow: "next_week",
    buildOutcome: ({ signals }) => {
      const magnitude = signals.find((s) => s.signalKey === "revenue_down")?.magnitude ?? 0.08;
      const pct = -Math.round(Math.min(25, magnitude * 100));
      return {
        predictedOutcome: `Likely ${pct}% next week`,
        predictedValue: pct,
        predictedUnit: "percent",
        description: "Revenue decline trend from baseline and inventory/traffic signals",
      };
    },
  },
  {
    predictionType: "seo_traffic_decline",
    predictionKey: "forecast:seo_traffic",
    title: "Organic traffic expected decline",
    requiredSignals: ["seo_down"],
    forecastWindow: "days_12",
    buildOutcome: ({ context }) => {
      const seoGaps = countEvidence(context, ["MissingSEO", "MissingMetaDescription"]);
      const pct = -Math.min(20, 6 + seoGaps);
      return {
        predictedOutcome: `Expected decline ${Math.abs(pct)}%`,
        predictedValue: pct,
        predictedUnit: "percent",
        description: "Missing metadata and SEO coverage gaps",
      };
    },
  },
  {
    predictionType: "pricing_margin_risk",
    predictionKey: "forecast:pricing_margin",
    title: "Margin likely below target",
    requiredSignals: ["pricing_anomaly"],
    forecastWindow: "days_12",
    buildOutcome: () => ({
      predictedOutcome: "Likely below target in 12 days",
      predictedValue: 12,
      predictedUnit: "days",
      description: "Pricing anomalies and margin risk signals detected",
    }),
  },
  {
    predictionType: "refund_increase",
    predictionKey: "forecast:refund_increase",
    title: "Refund trend expected increase",
    requiredSignals: ["refund_up"],
    forecastWindow: "days_7",
    buildOutcome: () => ({
      predictedOutcome: "Expected increase",
      predictedValue: null,
      predictedUnit: "trend",
      description: "Elevated refund risk signals in order history",
    }),
  },
  {
    predictionType: "collection_inactive",
    predictionKey: "forecast:collection_inactive",
    title: "Collection likely to become inactive",
    requiredSignals: ["collection_issue"],
    forecastWindow: "days_30",
    buildOutcome: ({ context }) => {
      const issues = countEvidence(context, ["OrphanCollection", "SingleProductCollection"]);
      return {
        predictedOutcome: `${issues} collection(s) at risk`,
        predictedValue: issues,
        predictedUnit: "collections",
        description: "Collection merchandising issues may lead to inactivity",
      };
    },
  },
  {
    predictionType: "operational_supplier_delay",
    predictionKey: "forecast:supplier_delay",
    title: "Operational supplier delay risk",
    requiredSignals: ["inventory_down"],
    forecastWindow: "days_7",
    buildOutcome: () => ({
      predictedOutcome: "Inventory shortage may impact revenue",
      predictedValue: null,
      predictedUnit: "risk",
      description: "Inventory pressure pattern suggests supply chain risk",
    }),
  },
];

export const PREVENTION_TEMPLATES: Record<
  string,
  {
    actionType: import("@prisma/client").PreventionActionType;
    title: string;
    buildAction: (prediction: {
      predictedValue: number | null;
      expectedBusinessImpact: number;
      affectedCount?: number;
    }) => { recommendedAction: string; expectedImpactProtected: number; expectedPreventionPct: number };
  }
> = {
  inventory_stockout: {
    actionType: "restock",
    title: "Restock before stockout",
    buildAction: (p) => ({
      recommendedAction: `Order ${Math.max(50, (p.affectedCount ?? 3) * 60)} units today`,
      expectedImpactProtected: p.expectedBusinessImpact * 0.85,
      expectedPreventionPct: 85,
    }),
  },
  revenue_forecast: {
    actionType: "monitor_trend",
    title: "Protect revenue trend",
    buildAction: (p) => ({
      recommendedAction: "Address inventory and traffic signals before next week",
      expectedImpactProtected: p.expectedBusinessImpact * 0.6,
      expectedPreventionPct: 60,
    }),
  },
  seo_traffic_decline: {
    actionType: "fix_metadata",
    title: "Fix SEO metadata",
    buildAction: (p) => ({
      recommendedAction: "Add meta descriptions to top products",
      expectedImpactProtected: p.expectedBusinessImpact * 0.7,
      expectedPreventionPct: 8,
    }),
  },
  pricing_margin_risk: {
    actionType: "adjust_pricing",
    title: "Review pricing strategy",
    buildAction: (p) => ({
      recommendedAction: "Review margin-risk products and adjust pricing",
      expectedImpactProtected: p.expectedBusinessImpact * 0.5,
      expectedPreventionPct: 50,
    }),
  },
  refund_increase: {
    actionType: "review_product",
    title: "Review high-refund products",
    buildAction: (p) => ({
      recommendedAction: "Review product quality and listing accuracy",
      expectedImpactProtected: p.expectedBusinessImpact * 0.55,
      expectedPreventionPct: 55,
    }),
  },
  collection_inactive: {
    actionType: "refresh_collection",
    title: "Refresh collection merchandising",
    buildAction: (p) => ({
      recommendedAction: "Add products and refresh collection merchandising",
      expectedImpactProtected: p.expectedBusinessImpact * 0.4,
      expectedPreventionPct: 40,
    }),
  },
  operational_supplier_delay: {
    actionType: "review_supplier",
    title: "Review supplier lead times",
    buildAction: (p) => ({
      recommendedAction: "Review supplier lead times and reorder points",
      expectedImpactProtected: p.expectedBusinessImpact * 0.75,
      expectedPreventionPct: 75,
    }),
  },
};

function countEvidence(
  context: { evidenceGroups: Map<string, { count: number }> },
  factTypes: string[],
): number {
  return factTypes.reduce(
    (sum, factType) => sum + (context.evidenceGroups.get(factType)?.count ?? 0),
    0,
  );
}
