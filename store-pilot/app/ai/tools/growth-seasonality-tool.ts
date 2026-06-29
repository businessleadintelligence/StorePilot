import { detectSeasonality } from "./seasonality-tool";

export function analyzeGrowthSeasonality(input: {
  salesByMonth: Array<{ month: number; quantity: number }>;
}): {
  seasonalStrength: number;
  peakMonth: number | null;
  score: number;
  issues: string[];
  signals: ReturnType<typeof detectSeasonality>["signals"];
} {
  const seasonality = detectSeasonality({ salesByMonth: input.salesByMonth });
  const seasonalStrength = seasonality.seasonalStrength;
  const score = Math.max(
    0,
    Math.min(100, Math.round(Math.min(seasonalStrength, 3) * 25 + (seasonality.peakMonth != null ? 20 : 0))),
  );
  const issues: string[] = [];

  if (seasonalStrength >= 1.5) issues.push("seasonal_peak_available");
  if (seasonalStrength < 1.1) issues.push("flat_seasonality_signal");

  return {
    seasonalStrength,
    peakMonth: seasonality.peakMonth,
    score,
    issues,
    signals: seasonality.signals,
  };
}
