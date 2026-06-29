import type { StoreAutomation } from "../automation/automation-types";
import type { ShopifyAdminClient } from "./shopify-admin-client";
import { executeCollectionMembershipMutation } from "./shopify-collection-mutations";
import {
  resolveShopifyCollectionId,
  resolveShopifyProductId,
} from "./shopify-dry-run";
import {
  parseAutomationMutationPayload,
  type AutomationMutationPayload,
  type MutationExecutionResult,
} from "./shopify-mutation-types";
import { executePriceMutation } from "./shopify-price-mutations";
import {
  executeProductTagsMutation,
  executeProductTypeMutation,
} from "./shopify-product-mutations";
import { executePublicationMutation } from "./shopify-publication-mutations";
import { executeSeoMetadataMutation } from "./shopify-seo-mutations";
import { ShopifyExecutionError } from "./shopify-errors";

export async function executeRegisteredMutation(input: {
  automation: StoreAutomation;
  client: ShopifyAdminClient;
  storeId: string;
}): Promise<MutationExecutionResult> {
  const payload = parseAutomationMutationPayload(
    input.automation.rollbackPlan.beforeState,
    input.automation.preview.expectedChanges,
  );
  const productId = await resolveShopifyProductId(input.storeId, payload);

  switch (input.automation.templateId) {
    case "update_product_tags":
      return executeProductTagsMutation({
        client: input.client,
        storeId: input.storeId,
        productId,
        payload,
      });
    case "update_product_type":
      return executeProductTypeMutation({
        client: input.client,
        storeId: input.storeId,
        productId,
        payload,
      });
    case "generate_seo_metadata":
      return executeSeoMetadataMutation({
        client: input.client,
        storeId: input.storeId,
        productId,
        payload,
      });
    case "publish_draft_product":
    case "unpublish_product":
      return executePublicationMutation({
        client: input.client,
        storeId: input.storeId,
        productId,
        templateId: input.automation.templateId,
        payload,
      });
    case "apply_compare_at_price":
      return executePriceMutation({
        client: input.client,
        storeId: input.storeId,
        productId,
        payload: withCompareAtOnly(payload),
      });
    case "update_product_price":
      return executePriceMutation({
        client: input.client,
        storeId: input.storeId,
        productId,
        payload,
      });
    case "move_product_between_collections": {
      const collectionId = await resolveShopifyCollectionId(input.storeId, payload);
      return executeCollectionMembershipMutation({
        client: input.client,
        storeId: input.storeId,
        productId,
        collectionId,
        payload,
      });
    }
    default:
      throw new ShopifyExecutionError(
        "mutation_not_supported",
        `Template ${input.automation.templateId} is not enabled for production execution`,
      );
  }
}

function withCompareAtOnly(payload: AutomationMutationPayload): AutomationMutationPayload {
  return {
    ...payload,
    price: undefined,
  };
}

export function buildMutationDescriptor(automation: StoreAutomation): Record<string, unknown> {
  return {
    templateId: automation.templateId,
    payload: parseAutomationMutationPayload(
      automation.rollbackPlan.beforeState,
      automation.preview.expectedChanges,
    ),
  };
}
