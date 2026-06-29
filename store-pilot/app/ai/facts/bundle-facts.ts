import { buildFactFingerprint } from "../cache/fingerprint";
import type { UnifiedStoreMetrics } from "../../connectors/normalization/normalized-metrics";
import { getTrafficMetrics } from "../migration/unified-metrics-migration";
import {
  buildCoPurchasePairs,
  calculateAttachRate,
  isInventoryCompatible,
  productsShareRelationship,
} from "../tools/bundle-analysis-tool";
import { calculateBundleConfidence, passesMinimumBundleConfidence } from "../tools/bundle-confidence-tool";
import { calculateBundleHealthScore } from "../tools/bundle-health-tool";
import {
  calculateBundleComplexity,
  calculateCombinedMarginScore,
  estimateBundleImpact,
  passesBundleSafetyConstraints,
} from "../tools/bundle-impact-tool";
import {
  classifyBundleOpportunity,
  estimatePotentialAttachRate,
  estimatePotentialInventoryReduction,
} from "../tools/bundle-opportunity-tool";
import { calculateBundlePriorityScore, rankBundleCandidates } from "../tools/bundle-ranking-tool";
import { dedupeBundleCandidates } from "../tools/bundle-similarity-tool";
import { calculateSalesWindowMetrics } from "../tools";
import { classifyDeadStock } from "../tools/inventory-aging-tool";
import { calculateInventoryVelocity } from "../tools/inventory-velocity-tool";
import type { FactBuilder, FactBuilderContext } from "./types";

export type BundleProductFacts = {
  productId: string;
  title: string;
  sku: string | null;
  shopifyProductId: string;
  price: number | null;
  inventory: number | null;
  sales30Days: number;
  velocity: number;
  agingDays: number;
  deadStock: boolean;
};

export type BundleCandidateFacts = {
  id: string;
  productIds: string[];
  titles: string[];
  bundleType: string;
  confidence: number;
  attachRate: number;
  complexity: "simple" | "moderate" | "complex";
  inventoryCompatible: boolean;
  expectedInventoryReduction: number;
  potentialAttachRate: number;
  priorityScore: number;
  sharedRelationships: string[];
  coPurchaseCount: number;
};

export type BundleFacts = {
  storeId: string;
  computedAt: string;
  bundleHealthScore: number;
  totalProducts: number;
  candidateCount: number;
  highConfidenceCount: number;
  deadInventoryPairCount: number;
  averageConfidence: number;
  potentialAttachRate: number;
  potentialInventoryReduction: number;
  bundleSuccessRate: number | null;
  implementedBundleIds: string[];
  products: BundleProductFacts[];
  bundleCandidates: BundleCandidateFacts[];
  coPurchasePairs: Array<{
    primaryProductId: string;
    pairedProductId: string;
    coPurchaseCount: number;
    attachRate: number;
  }>;
};

export type BundleFactsSource = {
  getStoreBundleSnapshot(input: { storeId: string }): Promise<{
    products: Array<{
      productId: string;
      title: string;
      sku: string | null;
      shopifyProductId: string;
      shopifyVariantId: string;
      price: number | null;
      inventory: number | null;
      updatedAt: string;
      salesByDay: Array<{ day: string; quantity: number }>;
    }>;
    orders: Array<Array<{ productId: string }>>;
    implementedBundleProductSets: string[][];
    bundleRecommendationCount: number;
    verifiedBundleCount: number;
    unifiedMetrics: UnifiedStoreMetrics;
  } | null>;
};

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return Number((values.reduce((total, value) => total + value, 0) / values.length).toFixed(2));
}

function bundleCandidateId(productIds: string[]): string {
  return `bundle:${[...productIds].sort().join(":")}`;
}

function isAlreadyBundled(productIds: string[], implementedSets: string[][]): boolean {
  const key = [...productIds].sort().join(":");
  return implementedSets.some((set) => [...set].sort().join(":") === key);
}

export function createBundleFactsBuilder(source: BundleFactsSource): FactBuilder<BundleFacts> {
  return {
    agentId: "bundle_discovery",
    async build(context: FactBuilderContext): Promise<BundleFacts> {
      const snapshot = await source.getStoreBundleSnapshot({ storeId: context.storeId });

      if (!snapshot) {
        throw new Error("bundle_facts_unavailable");
      }

      const computedAt = new Date().toISOString();
      void getTrafficMetrics(snapshot.unifiedMetrics);
      const productMap = new Map(snapshot.products.map((product) => [product.productId, product]));

      const products: BundleProductFacts[] = snapshot.products.map((product) => {
        const sales = calculateSalesWindowMetrics({
          quantitiesByDay: product.salesByDay.map((entry) => ({
            day: entry.day,
            quantity: entry.quantity,
            revenue: 0,
            orderCount: 0,
          })),
        });
        const velocity = calculateInventoryVelocity(sales.sales30Days);
        const lastSaleDay =
          [...product.salesByDay].sort((left, right) => right.day.localeCompare(left.day))[0]?.day ??
          null;
        const agingDays = lastSaleDay
          ? Math.max(
              0,
              Math.round(
                (Date.parse(computedAt) - Date.parse(`${lastSaleDay}T00:00:00.000Z`)) /
                  (24 * 60 * 60 * 1000),
              ),
            )
          : 90;

        return {
          productId: product.productId,
          title: product.title,
          sku: product.sku,
          shopifyProductId: product.shopifyProductId,
          price: product.price,
          inventory: product.inventory,
          sales30Days: sales.sales30Days,
          velocity,
          agingDays,
          deadStock: classifyDeadStock({
            agingDays,
            velocity,
            availableInventory: product.inventory,
            sales90Days: sales.sales90Days,
          }),
        };
      });

      const coPurchasePairs = buildCoPurchasePairs(snapshot.orders).slice(0, 40);
      const rawCandidates: BundleCandidateFacts[] = [];

      for (const pair of coPurchasePairs) {
        const left = productMap.get(pair.primaryProductId);
        const right = productMap.get(pair.pairedProductId);
        const leftFacts = products.find((item) => item.productId === pair.primaryProductId);
        const rightFacts = products.find((item) => item.productId === pair.pairedProductId);

        if (!left || !right || !leftFacts || !rightFacts) {
          continue;
        }

        const productIds = [pair.primaryProductId, pair.pairedProductId];
        if (isAlreadyBundled(productIds, snapshot.implementedBundleProductSets)) {
          continue;
        }

        const sharedRelationships = productsShareRelationship({
          left: {
            shopifyProductId: left.shopifyProductId,
            sku: left.sku,
            title: left.title,
          },
          right: {
            shopifyProductId: right.shopifyProductId,
            sku: right.sku,
            title: right.title,
          },
        });
        const attachRate = calculateAttachRate(pair.coPurchaseCount, pair.orderCount);
        const inventoryCompatible = isInventoryCompatible(left.inventory, right.inventory);
        const confidence = calculateBundleConfidence({
          attachRate,
          coPurchaseCount: pair.coPurchaseCount,
          sharedRelationshipCount: sharedRelationships.length,
          inventoryCompatible,
        });

        if (!passesMinimumBundleConfidence(confidence)) {
          continue;
        }

        const combinedMarginScore = calculateCombinedMarginScore(left.price, right.price);
        const bundleType = classifyBundleOpportunity({
          attachRate,
          leftVelocity: leftFacts.velocity,
          rightVelocity: rightFacts.velocity,
          leftAgingDays: leftFacts.agingDays,
          rightAgingDays: rightFacts.agingDays,
          combinedMarginScore,
          sharedRelationshipCount: sharedRelationships.length,
        });
        const slowInventory = Math.max(
          leftFacts.deadStock ? (left.inventory ?? 0) : 0,
          rightFacts.deadStock ? (right.inventory ?? 0) : 0,
        );
        const expectedInventoryReduction = estimatePotentialInventoryReduction({
          slowProductInventory: slowInventory,
          bundleConfidence: confidence,
        });
        const potentialAttachRate = estimatePotentialAttachRate({
          currentAttachRate: attachRate,
          bundleConfidence: confidence,
        });
        const complexity = calculateBundleComplexity(productIds.length);
        const impact = estimateBundleImpact({
          bundleConfidence: confidence,
          attachRate,
          inventoryReduction: expectedInventoryReduction,
          combinedPrice: (left.price ?? 0) + (right.price ?? 0),
        });

        if (
          !passesBundleSafetyConstraints({
            productCount: productIds.length,
            inventoryCompatible,
            confidence,
          })
        ) {
          continue;
        }

        rawCandidates.push({
          id: bundleCandidateId(productIds),
          productIds,
          titles: [left.title, right.title],
          bundleType,
          confidence,
          attachRate,
          complexity,
          inventoryCompatible,
          expectedInventoryReduction,
          potentialAttachRate,
          priorityScore: calculateBundlePriorityScore({
            confidence,
            attachRate,
            impact,
            complexity,
          }),
          sharedRelationships,
          coPurchaseCount: pair.coPurchaseCount,
        });
      }

      const dedupedCandidates = dedupeBundleCandidates(rawCandidates);
      const bundleCandidates = rankBundleCandidates(dedupedCandidates).slice(0, 12);
      const highConfidenceCount = bundleCandidates.filter((item) => item.confidence >= 0.7).length;
      const deadInventoryPairCount = bundleCandidates.filter(
        (item) => item.bundleType === "dead_inventory_bundle",
      ).length;
      const averageConfidence = average(bundleCandidates.map((item) => item.confidence));
      const potentialAttachRate = average(bundleCandidates.map((item) => item.potentialAttachRate));
      const potentialInventoryReduction = bundleCandidates.reduce(
        (total, item) => total + item.expectedInventoryReduction,
        0,
      );
      const bundleHealthScore = calculateBundleHealthScore({
        candidateCount: bundleCandidates.length,
        highConfidenceCount,
        deadInventoryPairCount,
        averageConfidence,
      });
      const bundleSuccessRate =
        snapshot.bundleRecommendationCount > 0
          ? Number(
              (
                snapshot.verifiedBundleCount / Math.max(1, snapshot.bundleRecommendationCount)
              ).toFixed(2),
            )
          : null;

      return {
        storeId: context.storeId,
        computedAt,
        bundleHealthScore,
        totalProducts: products.length,
        candidateCount: bundleCandidates.length,
        highConfidenceCount,
        deadInventoryPairCount,
        averageConfidence,
        potentialAttachRate,
        potentialInventoryReduction,
        bundleSuccessRate,
        implementedBundleIds: snapshot.implementedBundleProductSets.map((set) =>
          bundleCandidateId(set),
        ),
        products,
        bundleCandidates,
        coPurchasePairs: coPurchasePairs.slice(0, 10).map((pair) => ({
          primaryProductId: pair.primaryProductId,
          pairedProductId: pair.pairedProductId,
          coPurchaseCount: pair.coPurchaseCount,
          attachRate: calculateAttachRate(pair.coPurchaseCount, pair.orderCount),
        })),
      };
    },
    fingerprint(facts: BundleFacts): string {
      return buildFactFingerprint(facts as unknown as Record<string, unknown>);
    },
  };
}
