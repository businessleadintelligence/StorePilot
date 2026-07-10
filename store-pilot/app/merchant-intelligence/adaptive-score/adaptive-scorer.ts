import type {
  AdaptiveScoreRecord,
  DecisionJournalRecord,
  MerchantIntelligenceContext,
} from "../shared/types";

export function computeAdaptiveScore(input: {
  context: MerchantIntelligenceContext;
  entries: DecisionJournalRecord[];
  memoryVersionNumber: number;
  dnaVersionNumber: number;
}): AdaptiveScoreRecord {
  const participation = Math.min(100, input.entries.length * 8);
  const journalCoverage = Math.min(100, input.entries.length * 6);
  const experimentCompletion = Math.min(
    100,
    input.context.experiments.filter((e) => ["completed", "approved"].includes(e.status)).length * 20,
  );
  const accepted = input.entries.filter(
    (e) => e.merchantAction === "accepted" || e.merchantAction === "approved",
  ).length;
  const recommendationAcceptance = Math.min(
    100,
    (accepted / Math.max(1, input.entries.length)) * 100,
  );
  const predictionAccuracy = Math.min(
    100,
    input.context.predictions.reduce((s, p) => s + p.confidence, 0) /
      Math.max(1, input.context.predictions.length) *
      100,
  );
  const confidenceQuality = Math.min(100, input.context.businessStabilityScore);
  const memoryCoverage = Math.min(100, input.memoryVersionNumber * 15 + input.context.patternSeeds.length * 5);
  const learningFreshness = input.context.lastCheckpointAt ? 75 : 50;
  const dnaMaturity = Math.min(100, input.dnaVersionNumber * 20);
  const merchantFeedback = Math.min(100, accepted * 10);
  const cooImprovement = Math.min(100, input.context.executiveDecisions.length * 8);

  const components = {
    merchantParticipationScore: participation,
    journalCoverageScore: journalCoverage,
    experimentCompletionScore: experimentCompletion,
    recommendationAcceptanceScore: recommendationAcceptance,
    predictionAccuracyScore: predictionAccuracy,
    confidenceQualityScore: confidenceQuality,
    memoryCoverageScore: memoryCoverage,
    learningFreshnessScore: learningFreshness,
    dnaMaturityScore: dnaMaturity,
    merchantFeedbackScore: merchantFeedback,
    cooImprovementScore: cooImprovement,
  };

  const score = Math.round(
    participation * 0.12 +
      journalCoverage * 0.1 +
      experimentCompletion * 0.1 +
      recommendationAcceptance * 0.12 +
      predictionAccuracy * 0.1 +
      confidenceQuality * 0.08 +
      memoryCoverage * 0.1 +
      learningFreshness * 0.08 +
      dnaMaturity * 0.08 +
      merchantFeedback * 0.06 +
      cooImprovement * 0.06,
  );

  return { score: clamp(score, 0, 100), ...components };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
