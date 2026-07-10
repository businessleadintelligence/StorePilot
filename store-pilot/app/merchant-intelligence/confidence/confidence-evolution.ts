import type {
  ConfidenceEvolutionRecord,
  DecisionJournalRecord,
  MerchantIntelligenceContext,
} from "../shared/types";

const DOMAINS = [
  "pricing",
  "inventory",
  "seo",
  "operations",
  "collections",
  "merchandising",
];

export function evolveConfidence(input: {
  context: MerchantIntelligenceContext;
  entries: DecisionJournalRecord[];
}): ConfidenceEvolutionRecord[] {
  return DOMAINS.map((domain) => {
    const domainEntries = input.entries.filter(
      (e) =>
        String(e.businessContext.category ?? "").includes(domain) ||
        e.decisionType === domain ||
        e.title.toLowerCase().includes(domain),
    );
    const observationCount = domainEntries.length;
    const validated = domainEntries.filter(
      (e) => e.merchantAction === "confirmed" || e.merchantAction === "accepted",
    ).length;

    return {
      confidenceKey: `confidence:${domain}`,
      domain,
      confidenceScore: round(
        clamp(
          0.5 +
            validated * 0.04 +
            input.context.patternSeeds.length * 0.02 +
            input.context.businessStabilityScore / 500,
          0.4,
          0.99,
        ),
      ),
      observationCount,
      historicalSupport: round(Math.min(0.95, 0.4 + input.context.patternSeeds.length * 0.08)),
      merchantValidation: round(
        observationCount === 0 ? 0.5 : validated / observationCount,
      ),
      outcomeAccuracy: round(
        domainEntries.length === 0
          ? 0.5
          : domainEntries.reduce((s, e) => s + e.confidenceAfter, 0) /
            domainEntries.length,
      ),
      timeDecay: round(Math.max(0.3, 1 - observationCount * 0.02)),
      evidenceQuality: round(Math.min(0.9, 0.5 + observationCount * 0.05)),
      freshness: round(Math.min(0.95, 0.6 + input.context.experimentEvents.length * 0.05)),
      businessStability: round(input.context.businessStabilityScore / 100),
    };
  });
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function round(v: number): number {
  return Math.round(v * 10000) / 10000;
}
