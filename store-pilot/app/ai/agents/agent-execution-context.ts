import { AsyncLocalStorage } from "node:async_hooks";

import type { EvidenceCatalogEntry } from "./product-intelligence-evidence";
import type { InventoryEvidenceCatalogEntry } from "./inventory-intelligence-evidence";
import type { BundleEvidenceCatalogEntry } from "./bundle-discovery-evidence";
import type { StoreAuditEvidenceCatalogEntry } from "./store-audit-evidence";
import type { SeoIntelligenceEvidenceCatalogEntry } from "./seo-intelligence-evidence";
import type { PricingIntelligenceEvidenceCatalogEntry } from "./pricing-intelligence-evidence";
import type { GrowthIntelligenceEvidenceCatalogEntry } from "./growth-intelligence-evidence";
import type { ExecutiveCooEvidenceCatalogEntry } from "./executive-coo-evidence";
import type { TrendEvidenceCatalogEntry } from "./trend-intelligence-evidence";

export type ProductIntelligenceRecommendationMemory = {
  implementedIds: Set<string>;
  dismissedIds: Set<string>;
  openIds: Set<string>;
  snoozedIds: Set<string>;
  ignoredIds: Set<string>;
};

export type ProductIntelligenceExecutionContext = {
  storeId: string;
  subjectKey: string;
  recommendationMemory: ProductIntelligenceRecommendationMemory;
  evidenceCatalog?: EvidenceCatalogEntry[];
  recommendationRecords?: Array<{
    category: string;
    status: string;
    stableId: string;
    payloadJson: Record<string, unknown>;
  }>;
};

export type InventoryIntelligenceExecutionContext = {
  storeId: string;
  subjectKey: string;
  recommendationMemory: ProductIntelligenceRecommendationMemory;
  evidenceCatalog?: InventoryEvidenceCatalogEntry[];
  recommendationRecords?: Array<{
    category: string;
    status: string;
    stableId: string;
    payloadJson: Record<string, unknown>;
  }>;
};

export type BundleDiscoveryExecutionContext = {
  storeId: string;
  subjectKey: string;
  recommendationMemory: ProductIntelligenceRecommendationMemory;
  evidenceCatalog?: BundleEvidenceCatalogEntry[];
  recommendationRecords?: Array<{
    category: string;
    status: string;
    stableId: string;
    payloadJson: Record<string, unknown>;
  }>;
};

export type StoreAuditExecutionContext = {
  storeId: string;
  subjectKey: string;
  recommendationMemory: ProductIntelligenceRecommendationMemory;
  evidenceCatalog?: StoreAuditEvidenceCatalogEntry[];
  recommendationRecords?: Array<{
    category: string;
    status: string;
    stableId: string;
    payloadJson: Record<string, unknown>;
  }>;
};

export type TrendIntelligenceExecutionContext = {
  storeId: string;
  subjectKey: string;
  recommendationMemory: ProductIntelligenceRecommendationMemory;
  evidenceCatalog?: TrendEvidenceCatalogEntry[];
  recommendationRecords?: Array<{
    category: string;
    status: string;
    stableId: string;
    payloadJson: Record<string, unknown>;
  }>;
};

export type SeoIntelligenceExecutionContext = {
  storeId: string;
  subjectKey: string;
  recommendationMemory: ProductIntelligenceRecommendationMemory;
  evidenceCatalog?: SeoIntelligenceEvidenceCatalogEntry[];
  recommendationRecords?: Array<{
    category: string;
    status: string;
    stableId: string;
    payloadJson: Record<string, unknown>;
  }>;
};

export type PricingIntelligenceExecutionContext = {
  storeId: string;
  subjectKey: string;
  recommendationMemory: ProductIntelligenceRecommendationMemory;
  evidenceCatalog?: PricingIntelligenceEvidenceCatalogEntry[];
  recommendationRecords?: Array<{
    category: string;
    status: string;
    stableId: string;
    payloadJson: Record<string, unknown>;
  }>;
};

export type GrowthIntelligenceExecutionContext = {
  storeId: string;
  subjectKey: string;
  recommendationMemory: ProductIntelligenceRecommendationMemory;
  evidenceCatalog?: GrowthIntelligenceEvidenceCatalogEntry[];
  recommendationRecords?: Array<{
    category: string;
    status: string;
    stableId: string;
    payloadJson: Record<string, unknown>;
  }>;
};

export type ExecutiveCooExecutionContext = {
  storeId: string;
  subjectKey: string;
  recommendationMemory: ProductIntelligenceRecommendationMemory;
  evidenceCatalog?: ExecutiveCooEvidenceCatalogEntry[];
  recommendationRecords?: Array<{
    category: string;
    status: string;
    stableId: string;
    payloadJson: Record<string, unknown>;
  }>;
};

const productStorage = new AsyncLocalStorage<ProductIntelligenceExecutionContext>();
const inventoryStorage = new AsyncLocalStorage<InventoryIntelligenceExecutionContext>();
const bundleStorage = new AsyncLocalStorage<BundleDiscoveryExecutionContext>();
const storeAuditStorage = new AsyncLocalStorage<StoreAuditExecutionContext>();
const trendStorage = new AsyncLocalStorage<TrendIntelligenceExecutionContext>();
const seoStorage = new AsyncLocalStorage<SeoIntelligenceExecutionContext>();
const pricingStorage = new AsyncLocalStorage<PricingIntelligenceExecutionContext>();
const growthStorage = new AsyncLocalStorage<GrowthIntelligenceExecutionContext>();
const executiveCooStorage = new AsyncLocalStorage<ExecutiveCooExecutionContext>();

export function runWithProductIntelligenceContext<T>(
  context: ProductIntelligenceExecutionContext,
  fn: () => T | Promise<T>,
): T | Promise<T> {
  return productStorage.run(context, fn);
}

export function getProductIntelligenceExecutionContext(): ProductIntelligenceExecutionContext | undefined {
  return productStorage.getStore();
}

export function runWithInventoryIntelligenceContext<T>(
  context: InventoryIntelligenceExecutionContext,
  fn: () => T | Promise<T>,
): T | Promise<T> {
  return inventoryStorage.run(context, fn);
}

export function getInventoryIntelligenceExecutionContext(): InventoryIntelligenceExecutionContext | undefined {
  return inventoryStorage.getStore();
}

export function runWithBundleDiscoveryContext<T>(
  context: BundleDiscoveryExecutionContext,
  fn: () => T | Promise<T>,
): T | Promise<T> {
  return bundleStorage.run(context, fn);
}

export function getBundleDiscoveryExecutionContext(): BundleDiscoveryExecutionContext | undefined {
  return bundleStorage.getStore();
}

export function runWithStoreAuditContext<T>(
  context: StoreAuditExecutionContext,
  fn: () => T | Promise<T>,
): T | Promise<T> {
  return storeAuditStorage.run(context, fn);
}

export function getStoreAuditExecutionContext(): StoreAuditExecutionContext | undefined {
  return storeAuditStorage.getStore();
}

export function runWithTrendIntelligenceContext<T>(
  context: TrendIntelligenceExecutionContext,
  fn: () => T | Promise<T>,
): T | Promise<T> {
  return trendStorage.run(context, fn);
}

export function getTrendIntelligenceExecutionContext(): TrendIntelligenceExecutionContext | undefined {
  return trendStorage.getStore();
}

export function runWithSeoIntelligenceContext<T>(
  context: SeoIntelligenceExecutionContext,
  fn: () => T | Promise<T>,
): T | Promise<T> {
  return seoStorage.run(context, fn);
}

export function getSeoIntelligenceExecutionContext(): SeoIntelligenceExecutionContext | undefined {
  return seoStorage.getStore();
}

export function runWithPricingIntelligenceContext<T>(
  context: PricingIntelligenceExecutionContext,
  fn: () => T | Promise<T>,
): T | Promise<T> {
  return pricingStorage.run(context, fn);
}

export function getPricingIntelligenceExecutionContext(): PricingIntelligenceExecutionContext | undefined {
  return pricingStorage.getStore();
}

export function runWithGrowthIntelligenceContext<T>(
  context: GrowthIntelligenceExecutionContext,
  fn: () => T | Promise<T>,
): T | Promise<T> {
  return growthStorage.run(context, fn);
}

export function getGrowthIntelligenceExecutionContext(): GrowthIntelligenceExecutionContext | undefined {
  return growthStorage.getStore();
}

export function runWithExecutiveCooContext<T>(
  context: ExecutiveCooExecutionContext,
  fn: () => T | Promise<T>,
): T | Promise<T> {
  return executiveCooStorage.run(context, fn);
}

export function getExecutiveCooExecutionContext(): ExecutiveCooExecutionContext | undefined {
  return executiveCooStorage.getStore();
}

export function buildRecommendationMemoryFromRecords(
  records: Array<{
    status: string;
    stableId: string;
    payloadJson: Record<string, unknown>;
  }>,
): ProductIntelligenceRecommendationMemory {
  const implementedIds = new Set<string>();
  const dismissedIds = new Set<string>();
  const openIds = new Set<string>();
  const snoozedIds = new Set<string>();
  const ignoredIds = new Set<string>();

  for (const record of records) {
    const recommendationId = String(record.payloadJson.id ?? record.stableId);
    const status = record.status.toLowerCase();
    const feedback = String(record.payloadJson.feedback ?? "").toLowerCase();

    if (feedback === "snoozed" || record.payloadJson.snoozedUntil) {
      snoozedIds.add(recommendationId);
    }

    if (feedback === "ignored") {
      ignoredIds.add(recommendationId);
    }

    if (status === "implemented" || status === "verified" || status === "closed") {
      implementedIds.add(recommendationId);
      continue;
    }

    if (status === "dismissed") {
      dismissedIds.add(recommendationId);
      continue;
    }

    if (status === "open" || status === "viewed") {
      openIds.add(recommendationId);
    }
  }

  return {
    implementedIds,
    dismissedIds,
    openIds,
    snoozedIds,
    ignoredIds,
  };
}
