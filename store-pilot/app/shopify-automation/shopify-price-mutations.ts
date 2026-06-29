import type { ShopifyAdminClient } from "./shopify-admin-client";
import { assertNoUserErrors, readProductSnapshot, shopifyGraphql } from "./shopify-graphql";
import type { AutomationMutationPayload, MutationExecutionResult } from "./shopify-mutation-types";
import { ShopifyExecutionError } from "./shopify-errors";

const VARIANTS_BULK_UPDATE = `#graphql
  mutation AutomationVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
    productVariantsBulkUpdate(productId: $productId, variants: $variants) {
      productVariants {
        id
        price
        compareAtPrice
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export async function executePriceMutation(input: {
  client: ShopifyAdminClient;
  storeId: string;
  productId: string;
  payload: AutomationMutationPayload;
}): Promise<MutationExecutionResult> {
  const before = await readProductSnapshot(input.client, input.productId, input.storeId);
  const variant = before.variants.edges[0]?.node;
  if (!variant) {
    throw new ShopifyExecutionError("product_missing", "Product variant not found for price mutation");
  }

  const variantsInput: Record<string, unknown> = { id: variant.id };
  if (input.payload.price) variantsInput.price = input.payload.price;
  if (input.payload.compareAtPrice !== undefined) {
    variantsInput.compareAtPrice = input.payload.compareAtPrice;
  }

  const result = await shopifyGraphql<{
    productVariantsBulkUpdate: {
      productVariants: Array<{ id: string; price: string; compareAtPrice: string | null }> | null;
      userErrors: Array<{ field?: string[] | null; message: string }>;
    };
  }>(
    input.client,
    VARIANTS_BULK_UPDATE,
    { productId: input.productId, variants: [variantsInput] },
    { storeId: input.storeId },
  );
  assertNoUserErrors(result.data.productVariantsBulkUpdate.userErrors, "validation_error");

  const updated = result.data.productVariantsBulkUpdate.productVariants?.[0];
  return {
    mutationType: input.payload.price ? "product_price" : "compare_at_price",
    shopifyRequestId: result.requestId,
    oldValues: {
      price: variant.price,
      compareAtPrice: variant.compareAtPrice,
    },
    newValues: {
      price: updated?.price ?? input.payload.price ?? variant.price,
      compareAtPrice: updated?.compareAtPrice ?? input.payload.compareAtPrice ?? variant.compareAtPrice,
    },
    appliedChanges: [
      ...(input.payload.price
        ? [`price: ${variant.price} -> ${input.payload.price}`]
        : []),
      ...(input.payload.compareAtPrice !== undefined
        ? [`compareAtPrice: ${variant.compareAtPrice ?? "none"} -> ${input.payload.compareAtPrice ?? "none"}`]
        : []),
    ],
  };
}
