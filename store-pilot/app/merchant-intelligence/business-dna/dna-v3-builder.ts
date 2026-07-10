import type {
  BusinessDnaV3Record,
  MerchantBehaviorRecord,
  MerchantIntelligenceContext,
  PersonalizationRecord,
} from "../shared/types";

export function buildBusinessDnaV3(input: {
  context: MerchantIntelligenceContext;
  behavior: MerchantBehaviorRecord;
  personalization: PersonalizationRecord;
  journalCount: number;
  adaptiveScore: number;
  nextVersion: number;
}): BusinessDnaV3Record {
  const base = input.context.businessDna ?? {};
  return {
    versionNumber: input.nextVersion,
    businessCharacteristics: base,
    merchantDecisionStyle: input.personalization.decisionStyle,
    optimizationMaturity: round(input.adaptiveScore / 100),
    experimentMaturity: round(
      input.context.experiments.filter((e) => e.status === "completed" || e.status === "approved")
        .length / Math.max(1, input.context.experiments.length),
    ),
    riskTolerance: input.personalization.riskTolerance,
    automationReadiness: input.personalization.automationReadiness,
    operationalDiscipline: round(input.behavior.prefersOperationalEfficiency),
    learningVelocity: round(Math.min(1, input.journalCount / 20)),
    personalizationScore: round(
      input.personalization.priorityDomains.length / 5,
    ),
    decisionConsistency: round(1 - input.behavior.delaysDecisions),
    confidenceScore: round(input.adaptiveScore / 100),
  };
}

function round(v: number): number {
  return Math.round(v * 10000) / 10000;
}
