import type { MerchantIntelligenceContext } from "../shared/types";

export function buildMemoryUpdate(context: MerchantIntelligenceContext, nextVersion: number) {
  return {
    versionNumber: nextVersion,
    memoryJson: {
      patterns: context.patternSeeds.map((seed) => ({
        id: seed.id,
        patternType: seed.patternType,
        semanticLabel: seed.semanticLabel,
        confidence: seed.confidence,
      })),
      updatedAt: new Date().toISOString(),
      source: "merchant_intelligence_incremental",
    },
    patternCount: context.patternSeeds.length,
    confidenceScore: round(
      context.patternSeeds.reduce((s, p) => s + p.confidence, 0) /
        Math.max(1, context.patternSeeds.length),
    ),
  };
}

export function buildAdaptiveMemoryPatches(context: MerchantIntelligenceContext) {
  return context.patternSeeds.slice(0, 10).map((seed) => ({
    memoryKey: `memory:${seed.patternType}:${seed.id}`,
    memoryType: seed.patternType,
    memoryJson: seed.patternJson,
    confidence: seed.confidence,
    evidenceIds: [],
  }));
}

function round(v: number): number {
  return Math.round(v * 10000) / 10000;
}
