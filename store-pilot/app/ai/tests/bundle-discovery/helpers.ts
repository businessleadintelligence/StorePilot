import type { BundleFacts } from "../../facts/bundle-facts";
import { createMockUnifiedStoreMetricsForFacts } from "../../migration/unified-metrics-migration";
import type { BundleIntelligenceOutput } from "../../schemas/bundle-intelligence";

export function createMockBundleProduct(
  overrides: Partial<{
    productId: string;
    title: string;
    shopifyProductId: string;
    inventory: number;
    price: number;
  }> = {},
) {
  return {
    productId: overrides.productId ?? "product-1",
    title: overrides.title ?? "Blue Hoodie",
    sku: "BH-001",
    shopifyProductId: overrides.shopifyProductId ?? "shopify-product-1",
    shopifyVariantId: `${overrides.productId ?? "product-1"}-variant`,
    price: overrides.price ?? 49,
    inventory: overrides.inventory ?? 20,
    updatedAt: "2026-06-01T00:00:00.000Z",
    salesByDay: Array.from({ length: 10 }, (_, index) => ({
      day: `2026-06-${String(index + 11).padStart(2, "0")}`,
      quantity: 3,
    })),
  };
}

export function createMockBundleSnapshot() {
  const primary = createMockBundleProduct();
  const accessory = createMockBundleProduct({
    productId: "product-2",
    title: "Beanie Hat",
    shopifyProductId: "shopify-product-2",
    price: 19,
    inventory: 15,
  });

  return {
    products: [primary, accessory],
    orders: [
      [{ productId: "product-1" }, { productId: "product-2" }],
      [{ productId: "product-1" }, { productId: "product-2" }],
      [{ productId: "product-1" }, { productId: "product-2" }],
      [{ productId: "product-1" }, { productId: "product-2" }],
      [{ productId: "product-1" }, { productId: "product-2" }],
      [{ productId: "product-1" }],
    ],
    implementedBundleProductSets: [] as string[][],
    bundleRecommendationCount: 0,
    verifiedBundleCount: 0,
    unifiedMetrics: createMockUnifiedStoreMetricsForFacts(),
  };
}

export function buildBundleFactsFromSnapshot(
  snapshot = createMockBundleSnapshot(),
  storeId = "store-1",
): BundleFacts {
  const candidateId = "bundle:product-1:product-2";

  return {
    storeId,
    computedAt: "2026-06-20T10:00:00.000Z",
    bundleHealthScore: 78,
    totalProducts: snapshot.products.length,
    candidateCount: 1,
    highConfidenceCount: 1,
    deadInventoryPairCount: 0,
    averageConfidence: 0.72,
    potentialAttachRate: 0.48,
    potentialInventoryReduction: 4,
    bundleSuccessRate: null,
    implementedBundleIds: [],
    products: snapshot.products.map((product) => ({
      productId: product.productId,
      title: product.title,
      sku: product.sku,
      shopifyProductId: product.shopifyProductId,
      price: product.price,
      inventory: product.inventory,
      sales30Days: 30,
      velocity: 1,
      agingDays: 10,
      deadStock: false,
    })),
    bundleCandidates: [
      {
        id: candidateId,
        productIds: ["product-1", "product-2"],
        titles: ["Blue Hoodie", "Beanie Hat"],
        bundleType: "starter_kit",
        confidence: 0.72,
        attachRate: 0.83,
        complexity: "simple",
        inventoryCompatible: true,
        expectedInventoryReduction: 4,
        potentialAttachRate: 0.48,
        priorityScore: 82,
        sharedRelationships: ["shared_vendor", "shared_product_type"],
        coPurchaseCount: 5,
      },
    ],
    coPurchasePairs: [
      {
        primaryProductId: "product-1",
        pairedProductId: "product-2",
        coPurchaseCount: 5,
        attachRate: 0.83,
      },
    ],
  };
}

export function buildValidBundleDiscoveryDraft(
  facts: Pick<BundleFacts, "bundleHealthScore" | "bundleCandidates">,
): BundleIntelligenceOutput {
  const candidate = facts.bundleCandidates[0];
  if (!candidate) {
    throw new Error("missing_bundle_candidate");
  }

  return {
    summary: "Blue Hoodie and Beanie Hat frequently co-purchase and form a strong starter kit opportunity.",
    priority: 2,
    confidence: 0.9,
    bundleHealthScore: facts.bundleHealthScore,
    bundleCandidates: [
      {
        id: candidate.id,
        productIds: candidate.productIds,
        titles: candidate.titles,
        bundleType: candidate.bundleType,
        confidence: candidate.confidence,
        attachRate: candidate.attachRate,
        complexity: candidate.complexity,
        inventoryCompatible: candidate.inventoryCompatible,
        expectedInventoryReduction: candidate.expectedInventoryReduction,
        potentialAttachRate: candidate.potentialAttachRate,
      },
    ],
    findings: [
      {
        id: "copurchase-blue-hoodie-beanie",
        category: "Starter Kit",
        title: "Blue Hoodie and Beanie Hat co-purchase frequently",
        detail: "These products appear together in most recent multi-item orders.",
        severity: "high",
        confidence: 0.9,
      },
    ],
    recommendations: [
      {
        id: candidate.id,
        category: "Starter Kit",
        title: "Launch a Blue Hoodie + Beanie Hat starter kit",
        reason:
          "Customers already buy Blue Hoodie and Beanie Hat together in most multi-item orders, making a starter kit a natural next step.",
        bundleProductIds: candidate.productIds,
        evidenceKeys: [
          `candidate_${candidate.id}_confidence`,
          `candidate_${candidate.id}_attach_rate`,
          `copurchase_${candidate.productIds[0]}_${candidate.productIds[1]}`,
        ],
        merchantAction: [
          "Create a fixed-price starter kit containing Blue Hoodie and Beanie Hat",
          "Feature the kit on the hoodie product page as a recommended add-on",
        ],
        estimatedDifficulty: "Easy",
        confidence: 0.91,
        expectedResult: "Increase attach rate on hoodie orders over the next two weeks",
        potentialRisk: "Margin compression if the bundle discount is too deep",
        estimatedTime: "1-2 weeks",
        businessImpact: "Capture existing co-purchase behavior as a merchandised bundle",
      },
      {
        id: `${candidate.id}:accessory`,
        category: "Accessory Bundle",
        title: "Promote Beanie Hat as an accessory bundle on Blue Hoodie pages",
        reason: "Accessory bundling can lift average order value when paired with the hero hoodie SKU.",
        bundleProductIds: candidate.productIds,
        evidenceKeys: ["candidate_count", "potential_attach_rate", "bundle_health_score"],
        merchantAction: ["Add a post-add-to-cart accessory bundle offer for Beanie Hat"],
        estimatedDifficulty: "Medium",
        confidence: 0.78,
        expectedResult: "Lift attach rate on hoodie orders",
        potentialRisk: "Accessory offer may distract from higher-margin upsells",
        estimatedTime: "2 weeks",
        businessImpact: "Turn existing purchase patterns into higher basket value",
      },
    ],
    opportunities: ["Starter kit merchandising for top co-purchased pair"],
    risks: ["Missed attach rate if bundle is not merchandised on product pages"],
  };
}
