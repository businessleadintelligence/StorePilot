export type GrowthSectionAnalysis = { score: number; issues: string[]; opportunityCount?: number };

function scoreFromMetrics(input: { value: number; target: number; invert?: boolean }): number {
  const ratio = input.invert
    ? Math.min(1, input.value / Math.max(1, input.target))
    : Math.min(1, input.target <= 0 ? 0 : input.value / input.target);
  return Math.max(0, Math.min(100, Math.round(ratio * 100)));
}

export function analyzeGrowthAcquisition(input: {
  totalOrders30: number;
  previousOrders30: number;
  activeProducts: number;
}): GrowthSectionAnalysis {
  const growthRate =
    input.previousOrders30 <= 0
      ? input.totalOrders30 > 0
        ? 100
        : 0
      : Math.round(((input.totalOrders30 - input.previousOrders30) / input.previousOrders30) * 100);
  const score = scoreFromMetrics({ value: Math.max(0, growthRate + 50), target: 100 });
  const issues: string[] = [];
  if (growthRate < 0) issues.push("order_volume_declining");
  if (input.totalOrders30 < 10) issues.push("low_order_volume");
  return { score, issues, opportunityCount: growthRate < 10 ? 2 : 0 };
}

export function analyzeGrowthRetention(input: {
  repeatOrderProxy: number;
  refundRate: number;
}): GrowthSectionAnalysis {
  const score = scoreFromMetrics({ value: input.repeatOrderProxy, target: 35 });
  const issues: string[] = [];
  if (input.repeatOrderProxy < 20) issues.push("weak_repeat_purchase");
  if (input.refundRate > 8) issues.push("elevated_refund_rate");
  return { score, issues, opportunityCount: input.repeatOrderProxy < 25 ? 2 : 0 };
}

export function analyzeGrowthAov(input: { aov: number; previousAov: number }): GrowthSectionAnalysis {
  const aovTrend =
    input.previousAov <= 0 ? 0 : Math.round(((input.aov - input.previousAov) / input.previousAov) * 100);
  const score = scoreFromMetrics({ value: input.aov, target: 75 });
  const issues: string[] = [];
  if (input.aov < 45) issues.push("aov_below_target");
  if (aovTrend < -5) issues.push("aov_declining");
  return { score, issues, opportunityCount: input.aov < 55 ? 2 : 0 };
}

export function analyzeGrowthConversion(input: {
  conversionRate: number;
  averageDiscountPercent: number;
}): GrowthSectionAnalysis {
  const score = scoreFromMetrics({ value: input.conversionRate * 100, target: 3 });
  const issues: string[] = [];
  if (input.conversionRate < 0.015) issues.push("conversion_below_benchmark");
  if (input.averageDiscountPercent > 20) issues.push("discount_dependence_hurting_conversion");
  return { score, issues };
}

export function analyzeGrowthTraffic(input: {
  revenueGrowthRate: number;
  totalOrders30: number;
}): GrowthSectionAnalysis {
  const score = scoreFromMetrics({ value: Math.max(0, input.revenueGrowthRate + 50), target: 100 });
  const issues: string[] = [];
  if (input.revenueGrowthRate < 0) issues.push("revenue_declining");
  if (input.totalOrders30 < 15) issues.push("traffic_volume_low");
  return { score, issues };
}

export function analyzeGrowthProductMix(input: {
  fastMoverCount: number;
  slowMoverCount: number;
  totalProducts: number;
}): GrowthSectionAnalysis {
  const mixRatio =
    input.totalProducts <= 0 ? 0 : Math.round((input.fastMoverCount / input.totalProducts) * 100);
  const score = scoreFromMetrics({ value: mixRatio, target: 40 });
  const issues: string[] = [];
  if (input.slowMoverCount > input.fastMoverCount) issues.push("slow_movers_dominate_mix");
  if (mixRatio < 20) issues.push("weak_hero_product_mix");
  return { score, issues, opportunityCount: input.slowMoverCount >= 2 ? 2 : 0 };
}

export function analyzeGrowthChannel(input: {
  attachRateProxy: number;
  bundleCandidateCount: number;
}): GrowthSectionAnalysis {
  const score = scoreFromMetrics({ value: input.attachRateProxy * 100, target: 35 });
  const issues: string[] = [];
  if (input.attachRateProxy < 0.15) issues.push("low_cross_channel_attach");
  if (input.bundleCandidateCount < 2) issues.push("limited_channel_bundles");
  return { score, issues, opportunityCount: input.bundleCandidateCount >= 2 ? 1 : 0 };
}

export function analyzeGrowthRepeat(input: {
  repeatOrderProxy: number;
  totalOrders30: number;
}): GrowthSectionAnalysis {
  const score = scoreFromMetrics({ value: input.repeatOrderProxy, target: 30 });
  const issues: string[] = [];
  if (input.repeatOrderProxy < 15) issues.push("repeat_rate_low");
  if (input.totalOrders30 > 0 && input.repeatOrderProxy < 10) issues.push("one_time_buyer_dominance");
  return { score, issues };
}

export function analyzeGrowthUpsell(input: {
  aov: number;
  attachRateProxy: number;
  fastMoverCount: number;
}): GrowthSectionAnalysis {
  const score = scoreFromMetrics({ value: input.aov, target: 65 }) * 0.6 + scoreFromMetrics({ value: input.attachRateProxy * 100, target: 30 }) * 0.4;
  const rounded = Math.round(score);
  const issues: string[] = [];
  if (input.attachRateProxy < 0.12) issues.push("weak_upsell_attach");
  if (input.fastMoverCount < 2) issues.push("limited_upsell_anchors");
  return { score: rounded, issues, opportunityCount: input.attachRateProxy < 0.2 ? 2 : 0 };
}

export function analyzeGrowthSeasonal(input: {
  revenueGrowthRate: number;
  totalRevenue90: number;
  totalRevenue30: number;
}): GrowthSectionAnalysis {
  const momentum =
    input.totalRevenue90 <= 0
      ? 0
      : Math.round(((input.totalRevenue30 * 3 - input.totalRevenue90) / input.totalRevenue90) * 100);
  const score = scoreFromMetrics({ value: Math.max(0, momentum + 50), target: 100 });
  const issues: string[] = [];
  if (momentum < -10) issues.push("seasonal_momentum_fading");
  return { score, issues };
}

export function analyzeGrowthChurn(input: {
  refundRate: number;
  revenueGrowthRate: number;
}): GrowthSectionAnalysis {
  const score = scoreFromMetrics({ value: Math.max(0, 100 - input.refundRate * 8), target: 100 });
  const issues: string[] = [];
  if (input.refundRate > 6) issues.push("refund_churn_signal");
  if (input.revenueGrowthRate < -10) issues.push("revenue_churn_risk");
  return { score, issues };
}

export function analyzeGrowthExpansion(input: {
  activeProducts: number;
  fastMoverCount: number;
  revenueGrowthRate: number;
}): GrowthSectionAnalysis {
  const score =
    scoreFromMetrics({ value: input.fastMoverCount, target: Math.max(3, Math.floor(input.activeProducts * 0.2)) }) *
      0.5 +
    scoreFromMetrics({ value: Math.max(0, input.revenueGrowthRate + 50), target: 100 }) * 0.5;
  const rounded = Math.round(score);
  const issues: string[] = [];
  if (input.fastMoverCount < 2) issues.push("limited_expansion_anchors");
  if (input.revenueGrowthRate < 5) issues.push("expansion_momentum_weak");
  return { score: rounded, issues, opportunityCount: input.fastMoverCount >= 3 ? 2 : 0 };
}

export function analyzeGrowthRisk(input: {
  revenueRisk: number;
  churnRisk: number;
  conversionRisk: number;
}): GrowthSectionAnalysis {
  const composite = Math.round((input.revenueRisk + input.churnRisk + input.conversionRisk) / 3);
  const score = Math.max(0, 100 - composite);
  const issues: string[] = [];
  if (composite >= 60) issues.push("growth_risk_elevated");
  if (input.churnRisk >= 50) issues.push("churn_risk_high");
  return { score, issues };
}
