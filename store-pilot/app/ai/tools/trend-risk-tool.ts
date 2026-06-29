export function assessTrendRisk(input: {
  decliningProductCount: number;
  declineRate: number;
  storeGrowthRate: number;
}): "low" | "medium" | "high" {
  if (input.decliningProductCount >= 5 || input.declineRate >= 40 || input.storeGrowthRate <= -20) {
    return "high";
  }

  if (input.decliningProductCount >= 2 || input.declineRate >= 20 || input.storeGrowthRate <= -5) {
    return "medium";
  }

  return "low";
}
