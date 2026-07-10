import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildOrderFacts,
  buildProductFacts,
  computeCategoryAveragePrice,
} from "../fact-builder/product-facts";
import { normalizeShopifyOrder, normalizeShopifyProduct } from "../normalizer/shopify-normalizer";
import {
  extractShopifyId,
  mapShopifyProductStatus,
  parseShopifyMoney,
} from "../mapping/shopify-mapping";
import { computeQualityScores } from "../quality/quality-scorer";
import {
  validateEvidenceDraft,
  validateObservationDedupeKey,
  EvidenceValidationError,
} from "../validators/evidence-validator";
import { computeRetryDelay, executeWithRetry, isRetryableError } from "../../ai/foundation/retry/retry-engine";
import type { StorePilotProduct } from "../schemas/normalized-models";
import type { EvidenceDraft } from "../shared/types";
import { InMemoryKnowledgeEventSink, KnowledgeEventEmitter } from "../events/knowledge-events";
import { computeKnowledgeReadiness } from "../readiness/knowledge-readiness";

function buildProduct(overrides: Partial<StorePilotProduct> = {}): StorePilotProduct {
  return {
    shopifyProductId: "100",
    title: "Test Product",
    handle: "test-product",
    status: "active",
    productType: "Apparel",
    vendor: "Acme",
    tags: ["seasonal"],
    publishedAt: new Date().toISOString(),
    createdAt: new Date(Date.now() - 40 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
    descriptionHtml: "",
    seo: { title: null, description: null },
    collections: [{ shopifyCollectionId: "200", title: "Solo", productCount: 1 }],
    media: [],
    variants: [
      {
        shopifyVariantId: "101",
        shopifyProductId: "100",
        sku: "SKU-1",
        price: 100,
        compareAtPrice: 120,
        cost: 80,
        inventoryQuantity: 5,
        inventoryTracked: true,
        shopifyInventoryItemId: "inv-1",
      },
    ],
    totalInventory: 5,
    ...overrides,
  };
}

describe("Knowledge Ingestion Platform", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("mapping", () => {
    it("parses shopify money and ids", () => {
      expect(parseShopifyMoney("12.50")).toBe(12.5);
      expect(extractShopifyId("gid://shopify/Product/123")).toBe("123");
      expect(mapShopifyProductStatus("ACTIVE")).toBe("active");
    });
  });

  describe("normalizer", () => {
    it("normalizes shopify product payloads without customer fields", () => {
      const product = normalizeShopifyProduct({
        id: "gid://shopify/Product/1",
        title: "Shirt",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: ["cotton"],
        variants: {
          edges: [
            {
              node: {
                id: "gid://shopify/ProductVariant/2",
                price: "19.99",
                inventoryQuantity: 4,
                inventoryItem: { id: "gid://shopify/InventoryItem/3", tracked: true },
              },
            },
          ],
        },
      });
      expect(product.shopifyProductId).toBe("1");
      expect(product.variants[0].shopifyVariantId).toBe("2");
      expect(product.totalInventory).toBe(4);
    });

    it("normalizes orders with variant ids only", () => {
      const order = normalizeShopifyOrder({
        id: "gid://shopify/Order/9",
        name: "#1001",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        currencyCode: "USD",
        lineItems: {
          edges: [{ node: { variant: { id: "gid://shopify/ProductVariant/2" } } }],
        },
      });
      expect(order.shopifyOrderId).toBe("9");
      expect(order.variantIdsSold).toEqual(["2"]);
    });
  });

  describe("fact builder", () => {
    it("generates deterministic inventory and seo facts", () => {
      const product = buildProduct();
      const facts = buildProductFacts(product, {
        soldVariantIds: new Set(),
        categoryAveragePrice: 50,
        observedAt: new Date(),
      });
      const factTypes = facts.map((fact) => fact.factType);
      expect(factTypes).toContain("InventoryLow");
      expect(factTypes).toContain("MissingSEO");
      expect(factTypes).toContain("NeverSold");
      expect(factTypes).toContain("SingleProductCollection");
      expect(factTypes).toContain("MarginRiskCandidate");
    });

    it("builds refund seed facts from orders", () => {
      const facts = buildOrderFacts(
        {
          shopifyOrderId: "9",
          orderName: "#1001",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          processedAt: new Date().toISOString(),
          cancelledAt: null,
          currencyCode: "USD",
          subtotalAmount: 100,
          totalPriceAmount: 100,
          totalRefundedAmount: 20,
          isTest: false,
          isPaid: true,
          lineItemCount: 1,
          variantIdsSold: ["101"],
        },
        { observedAt: new Date() },
      );
      expect(facts[0]?.factType).toBe("RefundRiskSeed");
    });

    it("computes category average price", () => {
      const average = computeCategoryAveragePrice([
        buildProduct(),
        buildProduct({
          shopifyProductId: "200",
          variants: [
            {
              shopifyVariantId: "201",
              shopifyProductId: "200",
              sku: null,
              price: 50,
              compareAtPrice: null,
              cost: null,
              inventoryQuantity: 1,
              inventoryTracked: true,
              shopifyInventoryItemId: null,
            },
          ],
        }),
      ]);
      expect(average).toBe(75);
    });
  });

  describe("quality", () => {
    it("scores confidence freshness and completeness", () => {
      const scores = computeQualityScores({
        sourcePriority: 100,
        observedAt: new Date(Date.now() - 180_000),
        fieldsPresent: 6,
        fieldsExpected: 8,
      });
      expect(scores.confidence).toBeGreaterThan(0.5);
      expect(scores.freshnessMinutes).toBe(3);
      expect(scores.completeness).toBe(0.75);
    });
  });

  describe("validators", () => {
    it("rejects invalid evidence drafts", () => {
      const draft: EvidenceDraft = {
        entity: "Product",
        entityId: "",
        factType: "InventoryLow",
        observedAt: new Date(),
        value: -1,
      };
      expect(() => validateEvidenceDraft(draft)).toThrow(EvidenceValidationError);
      expect(() => validateObservationDedupeKey("")).toThrow(EvidenceValidationError);
    });
  });

  describe("events", () => {
    it("emits normalized knowledge events", () => {
      const sink = new InMemoryKnowledgeEventSink();
      const emitter = new KnowledgeEventEmitter([sink]);
      emitter.evidenceCreated("store-1", "100", "InventoryLow", "Product");
      expect(sink.events[0]?.type).toBe("EvidenceCreated");
    });
  });

  describe("readiness meter", () => {
    it("computes domain readiness percentages", async () => {
      const readiness = await computeKnowledgeReadiness({
        storeId: "store-1",
        productCount: 100,
        orderCount: 20,
        evidenceCounts: {
          InventoryLow: 5,
          NeverSold: 3,
          MissingSEO: 10,
          PriceChanged: 2,
          RefundRiskSeed: 1,
        },
      });
      expect(readiness.overallPercent).toBeGreaterThan(0);
      expect(readiness.productIntelligencePercent).toBeGreaterThan(0);
      expect(readiness.executiveCooPercent).toBeGreaterThan(0);
    });
  });

  describe("collector retry behavior", () => {
    it("retries rate-limited provider errors", async () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      let attempts = 0;
      const result = await executeWithRetry(async () => {
        attempts += 1;
        if (attempts < 2) {
          throw new Error("429 rate limited");
        }
        return "ok";
      }, { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 2, jitterMs: 0 });
      expect(result.value).toBe("ok");
      expect(isRetryableError(new Error("network timeout"))).toBe(true);
      expect(computeRetryDelay(2, { maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 500, jitterMs: 0 })).toBe(200);
    });
  });
});
