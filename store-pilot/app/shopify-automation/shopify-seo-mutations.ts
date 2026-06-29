import type { ShopifyAdminClient } from "./shopify-admin-client";
import { assertNoUserErrors, readProductSnapshot, shopifyGraphql } from "./shopify-graphql";
import type { AutomationMutationPayload, MutationExecutionResult } from "./shopify-mutation-types";

const PRODUCT_UPDATE_MUTATION = `#graphql
  mutation AutomationSeoUpdate($input: ProductInput!) {
    productUpdate(input: $input) {
      product {
        id
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

export async function executeSeoMetadataMutation(input: {
  client: ShopifyAdminClient;
  storeId: string;
  productId: string;
  payload: AutomationMutationPayload;
}): Promise<MutationExecutionResult> {
  const before = await readProductSnapshot(input.client, input.productId, input.storeId);
  const seoInput = {
    title: input.payload.seoTitle ?? before.seo?.title ?? undefined,
    description: input.payload.seoDescription ?? before.seo?.description ?? undefined,
  };

  const result = await shopifyGraphql<{
    productUpdate: {
      product: { id: string; seo: { title: string | null; description: string | null } | null } | null;
      userErrors: Array<{ field?: string[] | null; message: string }>;
    };
  }>(
    input.client,
    PRODUCT_UPDATE_MUTATION,
    { input: { id: input.productId, seo: seoInput } },
    { storeId: input.storeId },
  );
  assertNoUserErrors(result.data.productUpdate.userErrors);

  return {
    mutationType: "seo_metadata",
    shopifyRequestId: result.requestId,
    oldValues: {
      seoTitle: before.seo?.title ?? null,
      seoDescription: before.seo?.description ?? null,
    },
    newValues: {
      seoTitle: seoInput.title ?? null,
      seoDescription: seoInput.description ?? null,
    },
    appliedChanges: [
      `seoTitle: ${before.seo?.title ?? "none"} -> ${seoInput.title ?? "none"}`,
      `seoDescription: ${before.seo?.description ?? "none"} -> ${seoInput.description ?? "none"}`,
    ],
  };
}
