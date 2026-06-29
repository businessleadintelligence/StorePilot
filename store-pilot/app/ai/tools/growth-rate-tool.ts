export function calculateGrowthRate(input: {
  currentPeriod: number;
  priorPeriod: number;
}): number {
  if (input.priorPeriod === 0) {
    return input.currentPeriod > 0 ? 100 : 0;
  }

  return Number((((input.currentPeriod - input.priorPeriod) / input.priorPeriod) * 100).toFixed(2));
}

export function calculateRollingGrowth(input: {
  sales7Days: number;
  sales30Days: number;
  salesPrior30Days: number;
}): {
  shortTermGrowthRate: number;
  mediumTermGrowthRate: number;
} {
  const recentWeekly = input.sales7Days;
  const priorWeekly = Math.max(0, input.sales30Days - input.sales7Days);
  const shortTermGrowthRate = calculateGrowthRate({
    currentPeriod: recentWeekly,
    priorPeriod: priorWeekly / 3,
  });
  const mediumTermGrowthRate = calculateGrowthRate({
    currentPeriod: input.sales30Days,
    priorPeriod: input.salesPrior30Days,
  });

  return { shortTermGrowthRate, mediumTermGrowthRate };
}
