import type { StoreAutomation } from "../../automation/automation-types";
import { getAutomationTemplate } from "../../automation/automation-templates";

const PRODUCT_GID = "gid://shopify/Product/1001";
const VARIANT_GID = "gid://shopify/ProductVariant/2001";
const COLLECTION_GID = "gid://shopify/Collection/3001";

export function buildExecutableAutomation(overrides: Partial<StoreAutomation> = {}): StoreAutomation {
  const template = getAutomationTemplate("update_product_tags");
  const now = new Date().toISOString();

  return {
    id: "auto-exec-1",
    storeId: "store-test-001",
    automationKey: "automation:update-tags",
    title: "Update Product Tags",
    summary: "Add SEO tags",
    status: "executing",
    templateId: "update_product_tags",
    sourceType: "operation",
    sourceId: "operation:tags-1",
    operationId: "operation:tags-1",
    riskLevel: "low",
    riskFactors: [],
    preview: {
      title: "Update Product Tags",
      summary: "Preview",
      products: ["Protein Powder"],
      expectedChanges: template.expectedChanges,
      estimatedTimeSavedMinutes: 10,
      noChangesExecuted: true,
    },
    rollbackPlan: {
      beforeState: {
        payload: {
          shopifyProductId: PRODUCT_GID,
          tags: { action: "replace", values: ["protein", "fitness", "bestseller"] },
          merchantId: "merchant-1",
        },
      },
      afterState: {},
      rollbackSteps: template.rollbackSteps,
    },
    verificationRules: template.verificationRules,
    approvalRequired: true,
    merchantApproved: true,
    merchantRejected: false,
    changeRequestNote: null,
    timeline: {
      created: now,
      prepared: now,
      waitingApproval: now,
      approved: now,
      executing: now,
      executed: null,
      verifying: null,
      verified: null,
      archived: null,
      cancelled: null,
    },
    estimatedTimeSavedMinutes: 10,
    revenueInfluenced: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function createMockGraphqlRouter(initialTags: string[] = ["protein"]) {
  let tags = [...initialTags];
  let productType = "Supplements";
  let status = "ACTIVE";
  let seoTitle: string | null = "Protein Powder";
  let seoDescription: string | null = null;
  let price = "29.99";
  let compareAtPrice: string | null = null;
  const collectionProductIds = new Set<string>();

  return async (query: string, options?: { variables?: Record<string, unknown> }) => {
    const body = query.replace(/\s+/g, " ");

    if (body.includes("query AutomationProductSnapshot")) {
      return jsonResponse({
        data: {
          product: {
            id: PRODUCT_GID,
            tags,
            productType,
            status,
            seo: { title: seoTitle, description: seoDescription },
            variants: {
              edges: [{ node: { id: VARIANT_GID, price, compareAtPrice } }],
            },
          },
        },
      });
    }

    if (body.includes("mutation AutomationProductUpdate")) {
      const input = (options?.variables?.input ?? {}) as Record<string, unknown>;
      if (Array.isArray(input.tags)) tags = input.tags.map(String);
      if (typeof input.productType === "string") productType = input.productType;
      if (input.seo && typeof input.seo === "object") {
        const seo = input.seo as { title?: string; description?: string };
        if (seo.title !== undefined) seoTitle = seo.title;
        if (seo.description !== undefined) seoDescription = seo.description;
      }
      return jsonResponse({
        data: {
          productUpdate: {
            product: { id: PRODUCT_GID, tags, productType, seo: { title: seoTitle, description: seoDescription } },
            userErrors: [],
          },
        },
      });
    }

    if (body.includes("mutation AutomationProductChangeStatus")) {
      status = String(options?.variables?.status ?? status);
      return jsonResponse({
        data: {
          productChangeStatus: {
            product: { id: PRODUCT_GID, status },
            userErrors: [],
          },
        },
      });
    }

    if (body.includes("mutation AutomationVariantsBulkUpdate")) {
      const variants = (options?.variables?.variants ?? []) as Array<Record<string, unknown>>;
      const first = variants[0];
      if (typeof first?.price === "string") price = first.price;
      if (first?.compareAtPrice !== undefined) {
        compareAtPrice = first.compareAtPrice === null ? null : String(first.compareAtPrice);
      }
      return jsonResponse({
        data: {
          productVariantsBulkUpdate: {
            productVariants: [{ id: VARIANT_GID, price, compareAtPrice }],
            userErrors: [],
          },
        },
      });
    }

    if (body.includes("mutation AutomationCollectionAddProducts")) {
      const productIds = (options?.variables?.productIds ?? []) as string[];
      productIds.forEach((id) => collectionProductIds.add(id));
      return jsonResponse({
        data: { collectionAddProducts: { collection: { id: COLLECTION_GID }, userErrors: [] } },
      });
    }

    if (body.includes("mutation AutomationCollectionRemoveProducts")) {
      const productIds = (options?.variables?.productIds ?? []) as string[];
      productIds.forEach((id) => collectionProductIds.delete(id));
      return jsonResponse({
        data: { collectionRemoveProducts: { collection: { id: COLLECTION_GID }, userErrors: [] } },
      });
    }

    if (body.includes("query AutomationCollectionProducts")) {
      return jsonResponse({
        data: {
          collection: {
            id: COLLECTION_GID,
            products: {
              edges: [...collectionProductIds].map((id) => ({ node: { id } })),
            },
          },
        },
      });
    }

    return jsonResponse({ data: {} });
  };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "x-request-id": "shopify-request-test-1",
    },
  });
}

export { PRODUCT_GID, VARIANT_GID, COLLECTION_GID };
