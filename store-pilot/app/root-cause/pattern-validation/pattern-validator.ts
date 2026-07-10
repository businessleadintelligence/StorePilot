import type { RootCauseContextBundle } from "../shared/types";

export function validateAgainstPatterns(input: {
  context: RootCauseContextBundle;
  outcome: string;
  patternTypes: string[];
}): { supported: boolean; supportScore: number; matchedPatterns: string[] } {
  const matched = input.context.patternSeeds.filter((seed) =>
    input.patternTypes.includes(seed.patternType) ||
    input.patternTypes.includes(seed.semanticLabel),
  );

  if (matched.length === 0) {
    return { supported: true, supportScore: 0.5, matchedPatterns: [] };
  }

  const supportScore = Math.min(
    0.98,
    matched.reduce((sum, seed) => sum + seed.confidence, 0) / matched.length,
  );

  return {
    supported: supportScore >= 0.45,
    supportScore,
    matchedPatterns: matched.map((seed) => seed.patternType),
  };
}

export function validateAgainstBusinessDna(context: RootCauseContextBundle): number {
  if (!context.businessDna) {
    return 0.5;
  }
  return 0.65;
}
