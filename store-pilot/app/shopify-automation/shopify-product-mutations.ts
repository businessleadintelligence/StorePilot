import type { ShopifyAdminClient } from "./shopify-admin-client";
import { assertNoUserErrors, readProductSnapshot, shopifyGraphql } from "./shopify-graphql";
import type { AutomationMutationPayload, MutationExecutionResult } from "./shopify-mutation-types";

const PRODUCT_UPDATE_MUTATION = `#graphql
  mutation AutomationProductUpdate($input: ProductInput!) {
    productUpdate(input: $input) {
      product {
        id
        tags
        productType
        seo {
          title
          description
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export async function executeProductTagsMutation(input: {
  client: ShopifyAdminClient;
  storeId: string;
  productId: string;
  payload: AutomationMutationPayload;
}): Promise<MutationExecutionResult> {
  const before = await readProductSnapshot(input.client, input.productId, input.storeId);
  const nextTags = applyTagMutation(before.tags, input.payload.tags);
  const result = await shopifyGraphql<{
    productUpdate: {
      product: { id: string; tags: string[] } | null;
      userErrors: Array<{ field?: string[] | null; message: string }>;
    };
  }>(
    input.client,
    PRODUCT_UPDATE_MUTATION,
    { input: { id: input.productId, tags: nextTags } },
    { storeId: input.storeId },
  );
  assertNoUserErrors(result.data.productUpdate.userErrors);

  return {
    mutationType: "product_tags",
    shopifyRequestId: result.requestId,
    oldValues: { tags: before.tags },
    newValues: { tags: nextTags },
    appliedChanges: [`tags: ${before.tags.join(", ") || "none"} -> ${nextTags.join(", ") || "none"}`],
  };
}

export async function executeProductTypeMutation(input: {
  client: ShopifyAdminClient;
  storeId: string;
  productId: string;
  payload: AutomationMutationPayload;
}): Promise<MutationExecutionResult> {
  const before = await readProductSnapshot(input.client, input.productId, input.storeId);
  const result = await shopifyGraphql<{
    productUpdate: {
      product: { id: string; productType: string } | null;
      userErrors: Array<{ field?: string[] | null; message: string }>;
    };
  }>(
    input.client,
    PRODUCT_UPDATE_MUTATION,
    { input: { id: input.productId, productType: input.payload.productType } },
    { storeId: input.storeId },
  );
  assertNoUserErrors(result.data.productUpdate.userErrors);

  return {
    mutationType: "product_type",
    shopifyRequestId: result.requestId,
    oldValues: { productType: before.productType },
    newValues: { productType: input.payload.productType },
    appliedChanges: [`productType: ${before.productType || "none"} -> ${input.payload.productType}`],
  };
}

function applyTagMutation(
  currentTags: string[],
  tags?: AutomationMutationPayload["tags"],
): string[] {
  if (!tags) return currentTags;
  if (tags.action === "replace") return [...tags.values];
  if (tags.action === "add") {
    const merged = new Set([...currentTags, ...tags.values]);
    return [...merged];
  }
  return currentTags.filter((tag) => !tags.values.includes(tag));
}
