export type SeasonalitySignal = {
  label: string;
  strength: number;
  month: number;
};

export function detectSeasonality(input: {
  salesByMonth: Array<{ month: number; quantity: number }>;
}): {
  peakMonth: number | null;
  seasonalStrength: number;
  signals: SeasonalitySignal[];
} {
  if (input.salesByMonth.length === 0) {
    return { peakMonth: null, seasonalStrength: 0, signals: [] };
  }

  const total = input.salesByMonth.reduce((sum, entry) => sum + entry.quantity, 0);
  const average = total / input.salesByMonth.length;
  const peak = [...input.salesByMonth].sort((left, right) => right.quantity - left.quantity)[0];
  const seasonalStrength =
    average === 0 ? 0 : Math.round(((peak?.quantity ?? 0) / average) * 100) / 100;

  const signals: SeasonalitySignal[] = input.salesByMonth
    .filter((entry) => average > 0 && entry.quantity >= average * 1.2)
    .map((entry) => ({
      label: `Peak demand in month ${entry.month}`,
      strength: Number((entry.quantity / average).toFixed(2)),
      month: entry.month,
    }));

  return {
    peakMonth: peak?.month ?? null,
    seasonalStrength,
    signals,
  };
}
