import type { LearningDomain, LearningStage, LearningVelocityTier } from "@prisma/client";

import type {
  DomainConfidenceMap,
  LearningVelocityAssignment,
  StoreCatalogSnapshot,
  StoreComplexityScores,
} from "../shared/types";

const DOMAIN_VELOCITY: Record<LearningDomain, LearningVelocityTier> = {
  inventory: "fast",
  products: "fast",
  pricing: "medium",
  seo: "medium",
  collections: "medium",
  operations: "medium",
  seasonality: "slow",
  vendor_reliability: "slow",
  refund_behaviour: "slow",
  elasticity: "slow",
  executive_coo: "slow",
  prediction: "slow",
};

export function computeInitialConfidences(input: {
  snapshot: StoreCatalogSnapshot;
  scores: StoreComplexityScores;
}): DomainConfidenceMap {
  const { snapshot, scores } = input;
  const catalog = scores.catalogComplexityScore;
  const history = scores.historicalDepthScore;
  const ops = scores.operationalComplexityScore;

  return {
    inventory: clampPercent(52 + (snapshot.variantsCount > 0 ? 22 : 0) + ops * 10),
    products: clampPercent(48 + Math.min(24, Math.log10(snapshot.productsCount + 1) * 8) + catalog * 8),
    pricing: clampPercent(38 + history * 18 + catalog * 6),
    seo: clampPercent(28 + catalog * 12 + (snapshot.productsCount > 0 ? 8 : 0)),
    collections: clampPercent(34 + snapshot.collectionsCount > 0 ? 16 : 0 + catalog * 8),
    operations: clampPercent(40 + history * 20 + (snapshot.ordersCount > 0 ? 12 : 0)),
    seasonality: clampPercent(18 + history * 22),
  };
}

export function computeOverallConfidence(confidences: DomainConfidenceMap): number {
  const weighted =
    confidences.inventory * 0.2 +
    confidences.products * 0.2 +
    confidences.pricing * 0.15 +
    confidences.seo * 0.1 +
    confidences.collections * 0.1 +
    confidences.operations * 0.15 +
    confidences.seasonality * 0.1;
  return clampPercent(Math.round(weighted));
}

export function assignLearningVelocities(
  confidences: DomainConfidenceMap,
): LearningVelocityAssignment[] {
  const entries: Array<{ domain: LearningDomain; confidence: number }> = [
    { domain: "inventory", confidence: confidences.inventory },
    { domain: "products", confidence: confidences.products },
    { domain: "pricing", confidence: confidences.pricing },
    { domain: "seo", confidence: confidences.seo },
    { domain: "collections", confidence: confidences.collections },
    { domain: "operations", confidence: confidences.operations },
    { domain: "seasonality", confidence: confidences.seasonality },
    { domain: "vendor_reliability", confidence: 20 },
    { domain: "refund_behaviour", confidence: 24 },
    { domain: "elasticity", confidence: 30 },
  ];

  return entries.map(({ domain, confidence }) => {
    const velocity = DOMAIN_VELOCITY[domain];
    return {
      domain,
      velocity,
      statusLabel: statusLabelFor(velocity, confidence),
    };
  });
}

export function resolveBootstrapStage(): LearningStage {
  return "historical_import";
}

export function buildStageExplanation(stage: LearningStage): string {
  switch (stage) {
    case "initializing":
      return "StorePilot is estimating your catalog and order history before learning begins.";
    case "historical_import":
      return "StorePilot is importing historical operational data to seed intelligence.";
    case "learning":
      return "Evidence and graph relationships are being built from your store history.";
    case "operational":
      return "Operational intelligence is ready. Quick wins and daily insights unlock next.";
    case "predictive":
      return "Pattern discovery is active. Seasonality and trend intelligence improving.";
    case "adaptive":
      return "StorePilot is personalizing from merchant actions and outcomes.";
    default:
      return "StorePilot is preparing your learning profile.";
  }
}

export function buildMerchantMessage(input: {
  historyMonthsDisplay: number;
  totalEstimatedMinutes: number;
  overallConfidencePercent: number;
}): string {
  return `Analyzing approximately ${input.historyMonthsDisplay} months of operational history. Estimated confidence after import: ${input.overallConfidencePercent}%.`;
}

function statusLabelFor(velocity: LearningVelocityTier, confidence: number): string {
  if (velocity === "fast" && confidence >= 65) {
    return "Ready";
  }
  if (velocity === "fast") {
    return "Learning";
  }
  if (velocity === "medium" && confidence >= 50) {
    return "Improving";
  }
  if (velocity === "medium") {
    return "Learning";
  }
  return confidence >= 35 ? "Discovering" : "Not Ready";
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}
