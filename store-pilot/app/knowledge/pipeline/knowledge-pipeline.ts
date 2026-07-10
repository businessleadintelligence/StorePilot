import type { KnowledgeSyncMode } from "@prisma/client";

import type { StoreSyncAdminClient } from "../../services/store.server";
import { createShopifyKnowledgeCollector } from "../collector/shopify-collector";
import {
  countStoreOrders,
  countStoreProducts,
  loadNormalizedOrdersFromDb,
  loadNormalizedProductsFromDb,
  loadSoldVariantIds,
} from "../collector/database-collector";
import {
  loadKnowledgeCheckpoint,
  markCheckpointIdle,
  markCheckpointRunning,
  saveKnowledgeCheckpoint,
} from "../collector/checkpoint-store";
import { createEvidenceStore } from "../evidence/evidence-store";
import { createKnowledgeEventEmitter } from "../events/knowledge-events";
import {
  buildOrderFacts,
  buildProductFacts,
  computeCategoryAveragePrice,
} from "../fact-builder/product-facts";
import { normalizeShopifyOrder, normalizeShopifyProduct } from "../normalizer/shopify-normalizer";
import { persistKnowledgeReadiness } from "../readiness/knowledge-readiness";
import { DEFAULT_KNOWLEDGE_BATCH_SIZE } from "../shared/constants";
import type { KnowledgePipelineInput, KnowledgePipelineResult } from "../shared/types";
import type { StorePilotProduct } from "../schemas/normalized-models";

export type KnowledgePipelineDependencies = {
  admin?: StoreSyncAdminClient | null;
  useShopifyCollector?: boolean;
};

export async function runKnowledgeIngestionPipeline(
  input: KnowledgePipelineInput,
  deps: KnowledgePipelineDependencies = {},
): Promise<KnowledgePipelineResult> {
  const batchSize = input.batchSize ?? DEFAULT_KNOWLEDGE_BATCH_SIZE;
  const evidenceStore = createEvidenceStore();
  const events = createKnowledgeEventEmitter();
  const sourceId = await evidenceStore.ensureSource({
    storeId: input.storeId,
    sourceType: "shopify",
    sourceRef: input.syncMode,
    priority: 100,
  });

  await markCheckpointRunning(input.storeId);
  const checkpoint = await loadKnowledgeCheckpoint(input.storeId);
  let productsProcessed = checkpoint.productsProcessed;
  let ordersProcessed = checkpoint.ordersProcessed;
  let evidenceCreated = 0;
  let evidenceUpdated = 0;
  let eventsEmitted = 0;

  const soldVariantIds = await loadSoldVariantIds(input.storeId);
  const categoryAveragePrice = await resolveCategoryAverage(input.storeId, deps);
  const observedAt = new Date();

  if (deps.useShopifyCollector && deps.admin) {
    const collector = createShopifyKnowledgeCollector({
      admin: deps.admin,
      batchSize,
      checkpoint,
    });
    const productBatch = await collector.collectProductBatch();
    for (const raw of productBatch.products) {
      const product = normalizeShopifyProduct(raw);
      const result = await persistProductEvidence({
        storeId: input.storeId,
        product,
        sourceId,
        evidenceStore,
        events,
        soldVariantIds,
        categoryAveragePrice,
        observedAt,
      });
      evidenceCreated += result.created;
      evidenceUpdated += result.updated;
      eventsEmitted += result.events;
      productsProcessed += 1;
      events.productImported(input.storeId, product.shopifyProductId);
      eventsEmitted += 1;
    }
    checkpoint.productCursor = productBatch.nextCursor;
    checkpoint.productsProcessed = productsProcessed;

    if (input.syncMode !== "fact_refresh") {
      const orderBatch = await collector.collectOrderBatch();
      for (const raw of orderBatch.orders) {
        const order = normalizeShopifyOrder(raw);
        const result = await persistOrderEvidence({
          storeId: input.storeId,
          order,
          sourceId,
          evidenceStore,
          events,
          observedAt,
        });
        evidenceCreated += result.created;
        evidenceUpdated += result.updated;
        eventsEmitted += result.events;
        ordersProcessed += 1;
        events.orderImported(input.storeId, order.shopifyOrderId);
        eventsEmitted += 1;
      }
      checkpoint.orderCursor = orderBatch.nextCursor;
      checkpoint.ordersProcessed = ordersProcessed;
    }
  } else {
    const productSkip = input.resumeFromCheckpoint ? productsProcessed : 0;
    const products = await loadNormalizedProductsFromDb({
      storeId: input.storeId,
      skip: productSkip,
      take: batchSize,
    });
    for (const product of products) {
      const result = await persistProductEvidence({
        storeId: input.storeId,
        product,
        sourceId,
        evidenceStore,
        events,
        soldVariantIds,
        categoryAveragePrice,
        observedAt,
      });
      evidenceCreated += result.created;
      evidenceUpdated += result.updated;
      eventsEmitted += result.events;
      productsProcessed += 1;
      events.productImported(input.storeId, product.shopifyProductId);
      eventsEmitted += 1;
    }

    if (input.syncMode !== "fact_refresh") {
      const orderSkip = input.resumeFromCheckpoint ? ordersProcessed : 0;
      const orders = await loadNormalizedOrdersFromDb({
        storeId: input.storeId,
        skip: orderSkip,
        take: batchSize,
      });
      for (const order of orders) {
        const result = await persistOrderEvidence({
          storeId: input.storeId,
          order,
          sourceId,
          evidenceStore,
          events,
          observedAt,
        });
        evidenceCreated += result.created;
        evidenceUpdated += result.updated;
        eventsEmitted += result.events;
        ordersProcessed += 1;
        events.orderImported(input.storeId, order.shopifyOrderId);
        eventsEmitted += 1;
      }
    }
  }

  checkpoint.productsProcessed = productsProcessed;
  checkpoint.ordersProcessed = ordersProcessed;
  await saveKnowledgeCheckpoint({
    storeId: input.storeId,
    syncMode: input.syncMode,
    status: "idle",
    checkpoint,
    evidenceCreated,
  });
  await markCheckpointIdle(input.storeId);
  await persistKnowledgeReadiness(input.storeId);

  const totalProducts = await countStoreProducts(input.storeId);
  const totalOrders = await countStoreOrders(input.storeId);
  const hasMoreWork =
    productsProcessed < totalProducts ||
    (input.syncMode !== "fact_refresh" && ordersProcessed < totalOrders);

  return {
    success: !hasMoreWork || productsProcessed > 0 || ordersProcessed > 0,
    hasMoreWork,
    productsProcessed,
    ordersProcessed,
    evidenceCreated,
    evidenceUpdated,
    evidenceExpired: 0,
    eventsEmitted,
    checkpointSaved: true,
    readinessUpdated: true,
  };
}

async function persistProductEvidence(input: {
  storeId: string;
  product: StorePilotProduct;
  sourceId: string;
  evidenceStore: ReturnType<typeof createEvidenceStore>;
  events: ReturnType<typeof createKnowledgeEventEmitter>;
  soldVariantIds: Set<string>;
  categoryAveragePrice: number | null;
  observedAt: Date;
}): Promise<{ created: number; updated: number; events: number }> {
  const drafts = buildProductFacts(input.product, {
    soldVariantIds: input.soldVariantIds,
    categoryAveragePrice: input.categoryAveragePrice,
    observedAt: input.observedAt,
  });
  let created = 0;
  let updated = 0;
  let events = 0;
  for (const draft of drafts) {
    const result = await input.evidenceStore.upsertEvidence({
      storeId: input.storeId,
      draft,
      sourceId: input.sourceId,
      fieldsExpected: 8,
      fieldsPresent: countPresentProductFields(input.product),
    });
    if (result.created) {
      created += 1;
      input.events.evidenceCreated(
        input.storeId,
        draft.entityId,
        draft.factType,
        draft.entity,
      );
    } else if (result.updated) {
      updated += 1;
      input.events.evidenceUpdated(
        input.storeId,
        draft.entityId,
        draft.factType,
        draft.entity,
      );
    }
    events += 1;
    for (const variant of input.product.variants) {
      input.events.inventoryUpdated(input.storeId, variant.shopifyVariantId);
    }
    if (input.product.status === "archived") {
      input.events.productArchived(input.storeId, input.product.shopifyProductId);
    }
  }
  return { created, updated, events };
}

async function persistOrderEvidence(input: {
  storeId: string;
  order: import("../schemas/normalized-models").StorePilotOrder;
  sourceId: string;
  evidenceStore: ReturnType<typeof createEvidenceStore>;
  events: ReturnType<typeof createKnowledgeEventEmitter>;
  observedAt: Date;
}): Promise<{ created: number; updated: number; events: number }> {
  const drafts = buildOrderFacts(input.order, { observedAt: input.observedAt });
  let created = 0;
  let updated = 0;
  let events = 0;
  for (const draft of drafts) {
    const result = await input.evidenceStore.upsertEvidence({
      storeId: input.storeId,
      draft,
      sourceId: input.sourceId,
      fieldsExpected: 4,
      fieldsPresent: 4,
    });
    if (result.created) {
      created += 1;
      input.events.evidenceCreated(
        input.storeId,
        draft.entityId,
        draft.factType,
        draft.entity,
      );
    } else if (result.updated) {
      updated += 1;
      input.events.evidenceUpdated(
        input.storeId,
        draft.entityId,
        draft.factType,
        draft.entity,
      );
    }
    events += 1;
  }
  return { created, updated, events };
}

async function resolveCategoryAverage(
  storeId: string,
  deps: KnowledgePipelineDependencies,
): Promise<number | null> {
  if (deps.useShopifyCollector && deps.admin) {
    return null;
  }
  const products = await loadNormalizedProductsFromDb({ storeId, take: 250 });
  return computeCategoryAveragePrice(products);
}

function countPresentProductFields(product: StorePilotProduct): number {
  let count = 0;
  if (product.title) count += 1;
  if (product.descriptionHtml) count += 1;
  if (product.seo.title || product.seo.description) count += 1;
  if (product.variants.length > 0) count += 1;
  if (product.media.length > 0) count += 1;
  if (product.collections.length > 0) count += 1;
  if (product.vendor) count += 1;
  if (product.productType) count += 1;
  return count;
}

export type { KnowledgeSyncMode };
