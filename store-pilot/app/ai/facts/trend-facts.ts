import { buildFactFingerprint } from "../cache/fingerprint";
import { calculateSalesWindowMetrics } from "../tools/sales-tool";
import { calculateVelocity } from "../tools/velocity-tool";
import { buildCategoryTrends } from "../tools/category-trend-tool";
import { detectDecliningProducts, calculateDeclineRate } from "../tools/decline-detector-tool";
import { detectStoreTrendDirection } from "../tools/trend-detection-tool";
import { calculateRollingGrowth } from "../tools/growth-rate-tool";
import { detectOpportunityGaps } from "../tools/opportunity-gap-tool";
import { buildProductTrend, rankProductTrends, type ProductTrendEntry } from "../tools/product-trend-tool";
import { detectSeasonality } from "../tools/seasonality-tool";
import { calculateMomentum } from "../tools/momentum-tool";
import { assessTrendRisk } from "../tools/trend-risk-tool";
import { calculateTrendScore } from "../tools/trend-score-tool";
import { calculateTrendHealthScore } from "../tools/trend-health-tool";
import type { CategoryTrendEntry } from "../tools/category-trend-tool";
import type { SeasonalitySignal } from "../tools/seasonality-tool";
import type { FactBuilder, FactBuilderContext } from "./types";

export type TrendHistoricalSales = {
  total7Days: number;
  total30Days: number;
  total90Days: number;
  revenue30Days: number;
  byDay: Array<{ day: string; quantity: number; revenue: number }>;
};

export type TrendRollingGrowth = {
  storeGrowthRate: number;
  shortTermGrowthRate: number;
  mediumTermGrowthRate: number;
};

export type TrendRollingDecline = {
  decliningProductCount: number;
  declineRate: number;
};

export type TrendVelocityTrend = {
  averageVelocity: number;
  velocityChange: number;
};

export type TrendInventoryTrend = {
  risingInventorySkus: number;
  fallingInventorySkus: number;
};

export type TrendRevenueTrend = {
  revenue7Days: number;
  revenue30Days: number;
  growthRate: number;
};

export type TrendMomentumFacts = {
  emergingCount: number;
  decliningCount: number;
  averageMomentum: number;
};

export type TrendFacts = {
  storeId: string;
  computedAt: string;
  trendHealthScore: number;
  trendScore: number;
  trendDirection: "emerging" | "stable" | "declining" | "mixed" | "unknown";
  historicalSales: TrendHistoricalSales;
  rollingGrowth: TrendRollingGrowth;
  rollingDecline: TrendRollingDecline;
  velocityTrend: TrendVelocityTrend;
  categoryTrend: CategoryTrendEntry[];
  inventoryTrend: TrendInventoryTrend;
  revenueTrend: TrendRevenueTrend;
  seasonality: {
    peakMonth: number | null;
    seasonalStrength: number;
    signals: SeasonalitySignal[];
  };
  momentum: TrendMomentumFacts;
  riskLevel: "low" | "medium" | "high";
  opportunityLevel: "low" | "medium" | "high";
  products: ProductTrendEntry[];
  emergingProductIds: string[];
  decliningProductIds: string[];
  seasonalSignals: SeasonalitySignal[];
  implementedRecommendationIds: string[];
  dismissedRecommendationIds: string[];
};

export type TrendFactsSource = {
  getStoreTrendSnapshot(input: { storeId: string }): Promise<{
    products: Array<{
      productId: string;
      title: string;
      inventory: number | null;
      salesByDay: Array<{ day: string; quantity: number; revenue: number }>;
      salesPrior30Days: number;
    }>;
    storeRevenue7Days: number;
    storeRevenue30Days: number;
    storeRevenuePrior30Days: number;
    salesByMonth: Array<{ month: number; quantity: number }>;
    implementedRecommendationIds: string[];
    dismissedRecommendationIds: string[];
  } | null>;
};

function sumQuantity(entries: Array<{ quantity: number }>): number {
  return entries.reduce((total, entry) => total + entry.quantity, 0);
}

export function createTrendFactsBuilder(source: TrendFactsSource): FactBuilder<TrendFacts> {
  return {
    agentId: "trend_intelligence",
    async build(context: FactBuilderContext): Promise<TrendFacts> {
      const snapshot = await source.getStoreTrendSnapshot({ storeId: context.storeId });
      if (!snapshot) {
        throw new Error("trend_facts_unavailable");
      }

      const computedAt = new Date().toISOString();
      const products = snapshot.products.map((product) => {
        const sales = calculateSalesWindowMetrics({
          quantitiesByDay: product.salesByDay.map((entry) => ({
            day: entry.day,
            quantity: entry.quantity,
            revenue: entry.revenue,
            orderCount: 0,
          })),
        });
        const velocity = calculateVelocity(sales.sales30Days);
        return buildProductTrend({
          productId: product.productId,
          title: product.title,
          sales7Days: sales.sales7Days,
          sales30Days: sales.sales30Days,
          salesPrior30Days: product.salesPrior30Days,
          velocity,
        });
      });

      const rankedProducts = rankProductTrends(products);
      const emergingProducts = rankedProducts.filter((product) => product.direction === "emerging");
      const decliningProducts = detectDecliningProducts(rankedProducts);
      const categoryTrend = buildCategoryTrends(rankedProducts);
      const rollingGrowth = calculateRollingGrowth({
        sales7Days: sumQuantity(
          snapshot.products.flatMap((product) =>
            product.salesByDay.slice(-7).map((entry) => ({ quantity: entry.quantity })),
          ),
        ),
        sales30Days: sumQuantity(
          snapshot.products.flatMap((product) =>
            product.salesByDay.slice(-30).map((entry) => ({ quantity: entry.quantity })),
          ),
        ),
        salesPrior30Days: snapshot.products.reduce(
          (total, product) => total + product.salesPrior30Days,
          0,
        ),
      });

      const allSalesByDay = new Map<string, { quantity: number; revenue: number }>();
      for (const product of snapshot.products) {
        for (const entry of product.salesByDay) {
          const bucket = allSalesByDay.get(entry.day) ?? { quantity: 0, revenue: 0 };
          bucket.quantity += entry.quantity;
          bucket.revenue += entry.revenue;
          allSalesByDay.set(entry.day, bucket);
        }
      }

      const byDay = [...allSalesByDay.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([day, values]) => ({ day, quantity: values.quantity, revenue: values.revenue }));

      const historicalSales: TrendHistoricalSales = {
        total7Days: byDay.slice(-7).reduce((total, entry) => total + entry.quantity, 0),
        total30Days: byDay.slice(-30).reduce((total, entry) => total + entry.quantity, 0),
        total90Days: byDay.reduce((total, entry) => total + entry.quantity, 0),
        revenue30Days: snapshot.storeRevenue30Days,
        byDay,
      };

      const averageMomentum =
        rankedProducts.length === 0
          ? 0
          : Number(
              (
                rankedProducts.reduce((total, product) => total + product.momentum, 0) /
                rankedProducts.length
              ).toFixed(2),
            );

      const trendScore = calculateTrendScore({
        emergingProductCount: emergingProducts.length,
        decliningProductCount: decliningProducts.length,
        storeGrowthRate: rollingGrowth.mediumTermGrowthRate,
        averageMomentum,
        totalProducts: rankedProducts.length,
      });

      const declineRate = calculateDeclineRate({
        decliningProductCount: decliningProducts.length,
        totalProducts: rankedProducts.length,
      });

      const riskLevel = assessTrendRisk({
        decliningProductCount: decliningProducts.length,
        declineRate,
        storeGrowthRate: rollingGrowth.mediumTermGrowthRate,
      });

      const lowInventoryEmergingCount = snapshot.products.filter((product) => {
        const trend = rankedProducts.find((entry) => entry.productId === product.productId);
        return trend?.direction === "emerging" && (product.inventory ?? 0) < 10;
      }).length;

      const uncapturedCategoryCount = categoryTrend.filter(
        (entry) => entry.direction === "emerging" && entry.productCount >= 2,
      ).length;

      const opportunity = detectOpportunityGaps({
        emergingProductCount: emergingProducts.length,
        decliningProductCount: decliningProducts.length,
        lowInventoryEmergingCount,
        uncapturedCategoryCount,
      });

      const seasonality = detectSeasonality({ salesByMonth: snapshot.salesByMonth });
      const trendDirection = detectStoreTrendDirection({
        revenue7Days: snapshot.storeRevenue7Days,
        revenue30Days: snapshot.storeRevenue30Days,
        emergingProductCount: emergingProducts.length,
        decliningProductCount: decliningProducts.length,
      });

      const averageVelocity =
        rankedProducts.length === 0
          ? 0
          : Number(
              (
                rankedProducts.reduce((total, product) => total + product.velocity, 0) /
                rankedProducts.length
              ).toFixed(2),
            );

      const priorAverageVelocity =
        snapshot.products.length === 0
          ? 0
          : Number(
              (
                snapshot.products.reduce(
                  (total, product) => total + calculateVelocity(product.salesPrior30Days),
                  0,
                ) / snapshot.products.length
              ).toFixed(2),
            );

      const trendHealthScore = calculateTrendHealthScore({
        trendScore,
        emergingProductCount: emergingProducts.length,
        decliningProductCount: decliningProducts.length,
        riskLevel,
      });

      return {
        storeId: context.storeId,
        computedAt,
        trendHealthScore,
        trendScore,
        trendDirection,
        historicalSales,
        rollingGrowth: {
          storeGrowthRate: rollingGrowth.mediumTermGrowthRate,
          shortTermGrowthRate: rollingGrowth.shortTermGrowthRate,
          mediumTermGrowthRate: rollingGrowth.mediumTermGrowthRate,
        },
        rollingDecline: {
          decliningProductCount: decliningProducts.length,
          declineRate,
        },
        velocityTrend: {
          averageVelocity,
          velocityChange: Number((averageVelocity - priorAverageVelocity).toFixed(2)),
        },
        categoryTrend,
        inventoryTrend: {
          risingInventorySkus: snapshot.products.filter((product) => (product.inventory ?? 0) > 30).length,
          fallingInventorySkus: snapshot.products.filter((product) => (product.inventory ?? 0) <= 5).length,
        },
        revenueTrend: {
          revenue7Days: snapshot.storeRevenue7Days,
          revenue30Days: snapshot.storeRevenue30Days,
          growthRate: rollingGrowth.mediumTermGrowthRate,
        },
        seasonality,
        momentum: {
          emergingCount: emergingProducts.length,
          decliningCount: decliningProducts.length,
          averageMomentum,
        },
        riskLevel,
        opportunityLevel: opportunity.level,
        products: rankedProducts,
        emergingProductIds: emergingProducts.map((product) => product.productId),
        decliningProductIds: decliningProducts.map((product) => product.productId),
        seasonalSignals: seasonality.signals,
        implementedRecommendationIds: snapshot.implementedRecommendationIds,
        dismissedRecommendationIds: snapshot.dismissedRecommendationIds,
      };
    },
    fingerprint(facts: TrendFacts) {
      return buildFactFingerprint({
        storeId: facts.storeId,
        computedAt: facts.computedAt,
        trendHealthScore: facts.trendHealthScore,
        trendDirection: facts.trendDirection,
      });
    },
  };
}
