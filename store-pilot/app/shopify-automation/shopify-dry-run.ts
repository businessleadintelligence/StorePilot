import prisma from "../db.server";
import type { StoreAutomation } from "../automation/automation-types";
import {
  parseAutomationMutationPayload,
  PRODUCTION_MUTATION_TEMPLATES,
  type AutomationMutationPayload,
} from "./shopify-mutation-types";
import { ShopifyExecutionError } from "./shopify-errors";

export function validateAutomationDryRun(automation: StoreAutomation): void {
  if (!PRODUCTION_MUTATION_TEMPLATES.has(automation.templateId)) {
    throw new ShopifyExecutionError(
      "mutation_not_supported",
      `Template ${automation.templateId} is not enabled for production execution`,
    );
  }

  const payload = parseAutomationMutationPayload(
    automation.rollbackPlan.beforeState,
    automation.preview.expectedChanges,
  );

  switch (automation.templateId) {
    case "update_product_tags":
      requireProduct(payload);
      if (!payload.tags?.values?.length) {
        throw new ShopifyExecutionError("dry_run_validation_failed", "Tag mutation requires tag values");
      }
      break;
    case "update_product_type":
      requireProduct(payload);
      if (!payload.productType) {
        throw new ShopifyExecutionError("dry_run_validation_failed", "Product type is required");
      }
      break;
    case "generate_seo_metadata":
      requireProduct(payload);
      if (!payload.seoTitle && !payload.seoDescription) {
        throw new ShopifyExecutionError("dry_run_validation_failed", "SEO title or description is required");
      }
      break;
    case "publish_draft_product":
    case "unpublish_product":
      requireProduct(payload);
      break;
    case "apply_compare_at_price":
      requireProduct(payload);
      if (payload.compareAtPrice === undefined) {
        throw new ShopifyExecutionError("dry_run_validation_failed", "Compare-at price is required");
      }
      break;
    case "update_product_price":
      requireProduct(payload);
      if (!payload.price) {
        throw new ShopifyExecutionError("dry_run_validation_failed", "Price is required");
      }
      break;
    case "move_product_between_collections":
      requireProduct(payload);
      if (!payload.shopifyCollectionId && !payload.collectionId) {
        throw new ShopifyExecutionError("dry_run_validation_failed", "Collection id is required");
      }
      if (!payload.collectionAction) {
        throw new ShopifyExecutionError("dry_run_validation_failed", "Collection action is required");
      }
      break;
    default:
      break;
  }
}

function requireProduct(payload: AutomationMutationPayload): void {
  if (!payload.shopifyProductId && !payload.productId) {
    throw new ShopifyExecutionError("dry_run_validation_failed", "Product reference is required");
  }
}

export async function resolveShopifyProductId(
  storeId: string,
  payload: AutomationMutationPayload,
): Promise<string> {
  if (payload.shopifyProductId) {
    return payload.shopifyProductId.startsWith("gid://")
      ? payload.shopifyProductId
      : `gid://shopify/Product/${payload.shopifyProductId}`;
  }

  if (payload.productId) {
    const product = await prisma.product.findFirst({
      where: { storeId, id: payload.productId },
      select: { shopifyProductId: true },
    });
    if (product?.shopifyProductId) {
      return product.shopifyProductId.startsWith("gid://")
        ? product.shopifyProductId
        : `gid://shopify/Product/${product.shopifyProductId}`;
    }
  }

  throw new ShopifyExecutionError("product_missing", "Unable to resolve Shopify product id");
}

export async function resolveShopifyCollectionId(
  storeId: string,
  payload: AutomationMutationPayload,
): Promise<string> {
  if (payload.shopifyCollectionId) {
    return payload.shopifyCollectionId.startsWith("gid://")
      ? payload.shopifyCollectionId
      : `gid://shopify/Collection/${payload.shopifyCollectionId}`;
  }

  void storeId;
  void payload.collectionId;
  throw new ShopifyExecutionError("collection_missing", "Unable to resolve Shopify collection id");
}
