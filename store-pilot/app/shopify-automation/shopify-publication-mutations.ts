import type { ShopifyAdminClient } from "./shopify-admin-client";
import { assertNoUserErrors, readProductSnapshot, shopifyGraphql } from "./shopify-graphql";
import type { AutomationMutationPayload, MutationExecutionResult } from "./shopify-mutation-types";

const PRODUCT_CHANGE_STATUS_MUTATION = `#graphql
  mutation AutomationProductChangeStatus($productId: ID!, $status: ProductStatus!) {
    productChangeStatus(productId: $productId, status: $status) {
      product {
        id
        status
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export async function executePublicationMutation(input: {
  client: ShopifyAdminClient;
  storeId: string;
  productId: string;
  templateId: string;
  payload: AutomationMutationPayload;
}): Promise<MutationExecutionResult> {
  const before = await readProductSnapshot(input.client, input.productId, input.storeId);
  const nextStatus = resolveTargetStatus(input.templateId, input.payload);

  const result = await shopifyGraphql<{
    productChangeStatus: {
      product: { id: string; status: string } | null;
      userErrors: Array<{ field?: string[] | null; message: string }>;
    };
  }>(
    input.client,
    PRODUCT_CHANGE_STATUS_MUTATION,
    { productId: input.productId, status: nextStatus },
    { storeId: input.storeId },
  );
  assertNoUserErrors(result.data.productChangeStatus.userErrors);

  return {
    mutationType: "product_status",
    shopifyRequestId: result.requestId,
    oldValues: { status: before.status },
    newValues: { status: nextStatus },
    appliedChanges: [`status: ${before.status} -> ${nextStatus}`],
  };
}

function resolveTargetStatus(
  templateId: string,
  payload: AutomationMutationPayload,
): "ACTIVE" | "DRAFT" | "ARCHIVED" {
  if (payload.status) return payload.status;
  if (payload.publicationAction === "publish" || payload.publicationAction === "active") return "ACTIVE";
  if (payload.publicationAction === "unpublish" || payload.publicationAction === "draft") return "DRAFT";
  if (templateId === "publish_draft_product") return "ACTIVE";
  if (templateId === "unpublish_product") return "DRAFT";
  return "DRAFT";
}
