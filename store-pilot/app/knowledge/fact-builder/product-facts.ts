import type { StorePilotOrder, StorePilotProduct } from "../schemas/normalized-models";
import {
  DRAFT_TOO_LONG_DAYS,
  HIGH_INVENTORY_THRESHOLD,
  INVENTORY_CRITICAL_THRESHOLD,
  INVENTORY_LOW_THRESHOLD,
  LOW_MEDIA_COVERAGE_MIN,
  LOW_VARIANT_COVERAGE_MIN,
  RECENTLY_PUBLISHED_DAYS,
} from "../shared/constants";
import type { EvidenceDraft, KnowledgeFactType } from "../shared/types";

export type FactBuilderContext = {
  soldVariantIds: Set<string>;
  categoryAveragePrice: number | null;
  observedAt: Date;
};

export function buildProductFacts(
  product: StorePilotProduct,
  context: FactBuilderContext,
): EvidenceDraft[] {
  const facts: EvidenceDraft[] = [];
  const observedAt = context.observedAt;

  if (product.status === "draft") {
    const draftAgeDays = daysBetween(product.createdAt, observedAt);
    if (draftAgeDays >= DRAFT_TOO_LONG_DAYS) {
      facts.push(fact("Product", product.shopifyProductId, "DraftTooLong", {
        daysInDraft: draftAgeDays,
      }, observedAt));
    }
  }

  if (product.status === "archived") {
    facts.push(fact("Product", product.shopifyProductId, "Discontinued", null, observedAt));
  }

  if (product.status === "active" && product.publishedAt) {
    const publishedDays = daysBetween(product.publishedAt, observedAt);
    if (publishedDays <= RECENTLY_PUBLISHED_DAYS) {
      facts.push(fact("Product", product.shopifyProductId, "RecentlyPublished", {
        daysSincePublished: publishedDays,
      }, observedAt));
    }
  }

  if (!product.descriptionHtml?.trim()) {
    facts.push(fact("Product", product.shopifyProductId, "NoDescription", null, observedAt));
  }

  if (!product.seo.title?.trim() && !product.seo.description?.trim()) {
    facts.push(fact("Product", product.shopifyProductId, "MissingSEO", null, observedAt));
  }

  if (!product.seo.description?.trim()) {
    facts.push(fact("Product", product.shopifyProductId, "MissingMetaDescription", null, observedAt));
  }

  if (product.media.length < LOW_MEDIA_COVERAGE_MIN) {
    facts.push(fact("Product", product.shopifyProductId, "LowMediaCoverage", {
      mediaCount: product.media.length,
    }, observedAt));
  }

  if (product.media.some((entry) => !entry.alt?.trim())) {
    facts.push(fact("Product", product.shopifyProductId, "MissingAltText", null, observedAt));
  }

  if (product.variants.length < LOW_VARIANT_COVERAGE_MIN) {
    facts.push(fact("Product", product.shopifyProductId, "LowVariantCoverage", {
      variantCount: product.variants.length,
    }, observedAt));
  }

  if (product.status !== "active") {
    facts.push(fact("Product", product.shopifyProductId, "InactiveProduct", {
      status: product.status,
    }, observedAt));
  }

  for (const variant of product.variants) {
    facts.push(...buildVariantFacts(product, variant, context));
  }

  for (const collection of product.collections) {
    if (collection.productCount <= 1) {
      facts.push(fact("Collection", collection.shopifyCollectionId, "SingleProductCollection", {
        productCount: collection.productCount,
      }, observedAt));
    }
    if (collection.productCount === 0) {
      facts.push(fact("Collection", collection.shopifyCollectionId, "OrphanCollection", null, observedAt));
    }
  }

  const neverSold = product.variants.every(
    (variant) => !context.soldVariantIds.has(variant.shopifyVariantId),
  );
  if (neverSold && product.status === "active") {
    facts.push(fact("Product", product.shopifyProductId, "NeverSold", null, observedAt));
  }

  if (product.variants.length >= 2) {
    facts.push(fact("Product", product.shopifyProductId, "BundleCandidateSeed", {
      variantCount: product.variants.length,
    }, observedAt));
  }

  if (product.tags.some((tag) => /season/i.test(tag))) {
    facts.push(fact("Product", product.shopifyProductId, "SeasonalCandidate", null, observedAt));
  }

  return facts;
}

function buildVariantFacts(
  product: StorePilotProduct,
  variant: StorePilotProduct["variants"][number],
  context: FactBuilderContext,
): EvidenceDraft[] {
  const facts: EvidenceDraft[] = [];
  const observedAt = context.observedAt;
  const quantity = variant.inventoryQuantity;

  if (variant.inventoryTracked && quantity !== null) {
    if (quantity <= 0) {
      facts.push(fact("Variant", variant.shopifyVariantId, "OutOfStock", { quantity }, observedAt));
    } else if (quantity <= INVENTORY_CRITICAL_THRESHOLD) {
      facts.push(fact("Variant", variant.shopifyVariantId, "InventoryCritical", { quantity }, observedAt));
    } else if (quantity <= INVENTORY_LOW_THRESHOLD) {
      facts.push(fact("Variant", variant.shopifyVariantId, "InventoryLow", { quantity }, observedAt));
    } else if (quantity >= HIGH_INVENTORY_THRESHOLD) {
      facts.push(fact("Variant", variant.shopifyVariantId, "HighInventory", { quantity }, observedAt));
    }
  }

  if (
    variant.cost !== null &&
    variant.price !== null &&
    variant.price > 0 &&
    variant.cost / variant.price >= 0.7
  ) {
    facts.push(fact("Variant", variant.shopifyVariantId, "MarginRiskCandidate", {
      price: variant.price,
      cost: variant.cost,
    }, observedAt));
  }

  if (
    context.categoryAveragePrice !== null &&
    variant.price !== null &&
    variant.price > context.categoryAveragePrice * 1.25
  ) {
    facts.push(fact("Product", product.shopifyProductId, "PriceAboveCategoryAverage", {
      price: variant.price,
      categoryAverage: context.categoryAveragePrice,
    }, observedAt));
  }

  if (variant.compareAtPrice !== null && variant.price !== null && variant.compareAtPrice !== variant.price) {
    facts.push(fact("Variant", variant.shopifyVariantId, "PriceChanged", {
      price: variant.price,
      compareAtPrice: variant.compareAtPrice,
    }, observedAt));
  }

  return facts;
}

export function buildOrderFacts(
  order: StorePilotOrder,
  context: { observedAt: Date },
): EvidenceDraft[] {
  const facts: EvidenceDraft[] = [];
  if (order.totalRefundedAmount > 0) {
    facts.push(fact("Order", order.shopifyOrderId, "RefundRiskSeed", {
      totalRefundedAmount: order.totalRefundedAmount,
    }, context.observedAt));
  }
  return facts;
}

export function computeCategoryAveragePrice(products: StorePilotProduct[]): number | null {
  const prices = products
    .flatMap((product) => product.variants.map((variant) => variant.price))
    .filter((price): price is number => price !== null && price > 0);
  if (prices.length === 0) {
    return null;
  }
  return prices.reduce((sum, price) => sum + price, 0) / prices.length;
}

function fact(
  entity: EvidenceDraft["entity"],
  entityId: string,
  factType: KnowledgeFactType,
  value: EvidenceDraft["value"],
  observedAt: Date,
): EvidenceDraft {
  return { entity, entityId, factType, value: value ?? undefined, observedAt };
}

function daysBetween(isoDate: string, reference: Date): number {
  const start = new Date(isoDate).getTime();
  const end = reference.getTime();
  return Math.max(0, Math.floor((end - start) / (1000 * 60 * 60 * 24)));
}
