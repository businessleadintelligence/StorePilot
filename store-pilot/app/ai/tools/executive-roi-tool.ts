export function estimateExpectedRoi(input: {
  revenueImpact: number;
  profitImpact: number;
  implementationMinutes: number;
  difficulty: string;
  confidence: number;
}): {
  expectedRoi: number;
  roiRatio: number;
  paybackDays: number;
  issues: string[];
} {
  const issues: string[] = [];
  const effortHours = Math.max(1, input.implementationMinutes / 60);
  const effortCost = effortHours * 45;
  const difficultyMultiplier = input.difficulty === "Hard" ? 1.35 : input.difficulty === "Easy" ? 0.85 : 1;
  const adjustedProfit = input.profitImpact * input.confidence;
  const adjustedRevenue = input.revenueImpact * input.confidence * 0.35;

  const totalReturn = adjustedProfit + adjustedRevenue;
  const totalCost = effortCost * difficultyMultiplier;
  const roiRatio = totalCost <= 0 ? 0 : Number((totalReturn / totalCost).toFixed(2));
  const expectedRoi = Math.max(0, Math.min(100, Math.round(roiRatio * 18)));

  const dailyReturn = totalReturn / 30;
  const paybackDays = dailyReturn <= 0 ? 999 : Math.max(1, Math.round(totalCost / dailyReturn));

  if (roiRatio < 1) issues.push("roi_below_breakeven");
  if (paybackDays > 60) issues.push("long_payback_period");

  return { expectedRoi, roiRatio, paybackDays, issues };
}
