export function analyzeSeoOrganicOpportunity(input: {
  contentScore: number;
  technicalSeoScore: number;
  searchVisibilityScore: number;
  coreWebVitalsScore: number;
}): { score: number; issues: string[] } {
  const upside =
    (100 - input.contentScore) * 0.3 +
    (100 - input.technicalSeoScore) * 0.25 +
    (100 - input.searchVisibilityScore) * 0.25 +
    (100 - input.coreWebVitalsScore) * 0.2;
  return {
    score: Math.max(0, Math.min(100, Math.round(upside))),
    issues: upside >= 40 ? ["organic_opportunity_high"] : [],
  };
}
