import type { ExperimentDomain, ExperimentSourceType } from "@prisma/client";

import { DOMAIN_TO_EVIDENCE_FACTS, SOURCE_DOMAIN_MAP } from "../shared/constants";
import type {
  ExperimentContextBundle,
  ExperimentOpportunityRecord,
} from "../shared/types";

const PREDICTION_DOMAIN_MAP: Record<string, ExperimentDomain> = {
  pricing_margin_risk: "pricing",
  revenue_forecast: "pricing",
  inventory_stockout: "inventory",
  operational_supplier_delay: "inventory",
  seo_traffic_decline: "seo",
  collection_inactive: "collections",
  refund_increase: "operations",
};

const ROOT_CAUSE_DOMAIN_MAP: Record<string, ExperimentDomain> = {
  pricing_anomaly: "pricing",
  inventory_shortage: "inventory",
  traffic_loss: "seo",
  seo_degradation: "seo",
  collection_underperformance: "collections",
  refund_spike: "operations",
};

export function detectExperimentOpportunities(
  context: ExperimentContextBundle,
): ExperimentOpportunityRecord[] {
  const opportunities: ExperimentOpportunityRecord[] = [];

  for (const win of context.quickWins) {
    const domain = mapQuickWinDomain(win.winType);
    opportunities.push(
      buildOpportunity({
        key: `opp:quick_win:${win.id}`,
        domain,
        title: win.title,
        businessProblem: `Quick win opportunity: ${win.title}`,
        sourceType: "quick_win",
        sourceId: win.id,
        evidenceIds: win.evidenceIds,
        memoryIds: matchMemoryIds(context, domain),
        predictionIds: [],
        rootCauseIds: [],
        estimatedImpact: win.revenueOpportunity,
        confidence: 0.82,
        templateKey: defaultTemplateForDomain(domain),
      }),
    );
  }

  for (const cause of context.rootCauses) {
    const domain = ROOT_CAUSE_DOMAIN_MAP[cause.businessOutcome] ?? "operations";
    opportunities.push(
      buildOpportunity({
        key: `opp:root_cause:${cause.id}`,
        domain,
        title: `Address: ${cause.primaryCause}`,
        businessProblem: cause.primaryCause,
        sourceType: "root_cause",
        sourceId: cause.id,
        evidenceIds: cause.evidenceIds,
        memoryIds: matchMemoryIds(context, domain),
        predictionIds: [],
        rootCauseIds: [cause.id],
        estimatedImpact: estimateImpactFromConfidence(cause.confidence, context),
        confidence: cause.confidence,
        templateKey: defaultTemplateForDomain(domain),
      }),
    );
  }

  for (const prediction of context.predictions) {
    const domain = PREDICTION_DOMAIN_MAP[prediction.predictionType] ?? "operations";
    opportunities.push(
      buildOpportunity({
        key: `opp:prediction:${prediction.predictionKey}`,
        domain,
        title: prediction.title,
        businessProblem: `Prevent: ${prediction.title}`,
        sourceType: "prediction",
        sourceId: prediction.predictionKey,
        evidenceIds: prediction.evidenceIds,
        memoryIds: matchMemoryIds(context, domain),
        predictionIds: [prediction.predictionKey],
        rootCauseIds: [],
        estimatedImpact: prediction.expectedBusinessImpact,
        confidence: prediction.confidence,
        templateKey: defaultTemplateForDomain(domain),
      }),
    );
  }

  for (const seed of context.patternSeeds) {
    const domain = mapPatternDomain(seed.patternType);
    if (!domain) {
      continue;
    }
    opportunities.push(
      buildOpportunity({
        key: `opp:pattern:${seed.id}`,
        domain,
        title: `Pattern: ${seed.semanticLabel}`,
        businessProblem: `Historical pattern ${seed.semanticLabel} detected`,
        sourceType: "pattern",
        sourceId: seed.id,
        evidenceIds: collectEvidenceForDomain(context, domain),
        memoryIds: [seed.id],
        predictionIds: [],
        rootCauseIds: [],
        estimatedImpact: estimateImpactFromConfidence(seed.confidence, context),
        confidence: seed.confidence,
        templateKey: defaultTemplateForDomain(domain),
      }),
    );
  }

  for (const [domain, factTypes] of Object.entries(DOMAIN_TO_EVIDENCE_FACTS)) {
    const evidenceIds = collectEvidenceIds(context, factTypes);
    if (evidenceIds.length === 0) {
      continue;
    }
    if (opportunities.some((opp) => opp.domain === domain && opp.sourceType === "evidence")) {
      continue;
    }
    opportunities.push(
      buildOpportunity({
        key: `opp:evidence:${domain}`,
        domain: domain as ExperimentDomain,
        title: `Evidence-driven ${domain} optimization`,
        businessProblem: `${evidenceIds.length} ${domain} evidence signals detected`,
        sourceType: "evidence",
        sourceId: domain,
        evidenceIds,
        memoryIds: matchMemoryIds(context, domain),
        predictionIds: [],
        rootCauseIds: [],
        estimatedImpact: evidenceIds.length * getAov(context) * 0.05,
        confidence: Math.min(0.92, 0.6 + evidenceIds.length * 0.04),
        templateKey: defaultTemplateForDomain(domain as ExperimentDomain),
      }),
    );
  }

  return dedupeOpportunities(opportunities)
    .filter((opp) => opp.evidenceIds.length > 0 || opp.memoryIds.length > 0)
    .sort((a, b) => b.confidence * b.estimatedImpact - a.confidence * a.estimatedImpact);
}

function buildOpportunity(input: {
  key: string;
  domain: ExperimentDomain;
  title: string;
  businessProblem: string;
  sourceType: ExperimentSourceType;
  sourceId: string;
  evidenceIds: string[];
  memoryIds: string[];
  predictionIds: string[];
  rootCauseIds: string[];
  estimatedImpact: number;
  confidence: number;
  templateKey: string;
}): ExperimentOpportunityRecord {
  return {
    opportunityKey: input.key,
    domain: input.domain,
    title: input.title,
    businessProblem: input.businessProblem,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    evidenceIds: input.evidenceIds,
    memoryIds: input.memoryIds,
    predictionIds: input.predictionIds,
    rootCauseIds: input.rootCauseIds,
    estimatedImpact: roundCurrency(input.estimatedImpact),
    confidence: round(input.confidence),
    templateKey: input.templateKey,
  };
}

function defaultTemplateForDomain(domain: ExperimentDomain): string {
  const defaults: Record<ExperimentDomain, string> = {
    pricing: "pricing:price_increase",
    seo: "seo:meta_description",
    bundles: "bundles:cross_sell",
    inventory: "inventory:reorder_threshold",
    merchandising: "merchandising:featured_products",
    collections: "collections:merge",
    content: "content:description",
    operations: "operations:duplicate_cleanup",
  };
  return defaults[domain];
}

function mapQuickWinDomain(winType: string): ExperimentDomain {
  if (winType.includes("inventory")) return "inventory";
  if (winType.includes("seo")) return "seo";
  if (winType.includes("pricing")) return "pricing";
  if (winType.includes("collection")) return "collections";
  return "merchandising";
}

function mapPatternDomain(patternType: string): ExperimentDomain | null {
  if (patternType.includes("inventory")) return "inventory";
  if (patternType.includes("refund")) return "operations";
  if (patternType.includes("order") || patternType.includes("revenue")) return "pricing";
  if (patternType.includes("weekend")) return "merchandising";
  return null;
}

function matchMemoryIds(context: ExperimentContextBundle, domain: string): string[] {
  return context.patternSeeds
    .filter((seed) => (SOURCE_DOMAIN_MAP.pattern ?? []).includes(domain) || mapPatternDomain(seed.patternType) === domain)
    .map((seed) => seed.id)
    .slice(0, 5);
}

function collectEvidenceForDomain(
  context: ExperimentContextBundle,
  domain: string,
): string[] {
  return collectEvidenceIds(context, DOMAIN_TO_EVIDENCE_FACTS[domain] ?? []);
}

function collectEvidenceIds(context: ExperimentContextBundle, factTypes: string[]): string[] {
  const ids = new Set<string>();
  for (const factType of factTypes) {
    context.evidenceGroups.get(factType)?.evidenceIds.forEach((id) => ids.add(id));
  }
  return [...ids];
}

function estimateImpactFromConfidence(confidence: number, context: ExperimentContextBundle): number {
  return roundCurrency(getAov(context) * 30 * confidence * 0.08);
}

function getAov(context: ExperimentContextBundle): number {
  const revenue = context.merchantBaselines.find((b) => b.baselineType === "revenue");
  const aov = revenue?.baselineJson.averageOrderValue;
  return typeof aov === "number" && aov > 0 ? aov : 75;
}

function dedupeOpportunities(
  opportunities: ExperimentOpportunityRecord[],
): ExperimentOpportunityRecord[] {
  const map = new Map<string, ExperimentOpportunityRecord>();
  for (const opp of opportunities) {
    const existing = map.get(opp.opportunityKey);
    if (!existing || opp.confidence > existing.confidence) {
      map.set(opp.opportunityKey, opp);
    }
  }
  return [...map.values()];
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}
