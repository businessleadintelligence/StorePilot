import type { RootCauseExplanationPayload, RootCauseRecord } from "../shared/types";

export function buildExplanationPayload(
  cause: RootCauseRecord,
): RootCauseExplanationPayload {
  return {
    primaryCause: cause.primaryCause,
    secondaryCauses: cause.secondaryCauses,
    confidence: cause.confidence,
    timeline: cause.timeline,
    evidence: cause.evidenceIds.map((id) => ({ id })),
    causalChain: cause.causalChain,
    businessOutcome: cause.businessOutcome,
  };
}

export function buildExplanationPayloads(
  causes: RootCauseRecord[],
): RootCauseExplanationPayload[] {
  return causes.map(buildExplanationPayload);
}
