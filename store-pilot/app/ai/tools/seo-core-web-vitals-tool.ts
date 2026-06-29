export function analyzeSeoCoreWebVitals(input: {
  lcpScore: number;
  clsScore: number;
  inpScore: number;
}): { score: number; issues: string[]; lcp: number; cls: number; inp: number } {
  const issues: string[] = [];
  if (input.lcpScore < 70) issues.push("cwv_lcp_needs_improvement");
  if (input.clsScore < 70) issues.push("cwv_cls_needs_improvement");
  if (input.inpScore < 70) issues.push("cwv_inp_needs_improvement");
  return {
    score: Math.round((input.lcpScore + input.clsScore + input.inpScore) / 3),
    issues,
    lcp: input.lcpScore,
    cls: input.clsScore,
    inp: input.inpScore,
  };
}
