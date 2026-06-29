import type { ShopifyAdminClient } from "./shopify-admin-client";
import { assertNoUserErrors, shopifyGraphql } from "./shopify-graphql";
import type { AutomationMutationPayload, MutationExecutionResult } from "./shopify-mutation-types";

const COLLECTION_ADD_PRODUCTS = `#graphql
  mutation AutomationCollectionAddProducts($id: ID!, $productIds: [ID!]!) {
    collectionAddProducts(id: $id, productIds: $productIds) {
      collection {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const COLLECTION_REMOVE_PRODUCTS = `#graphql
  mutation AutomationCollectionRemoveProducts($id: ID!, $productIds: [ID!]!) {
    collectionRemoveProducts(id: $id, productIds: $productIds) {
      collection {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export async function executeCollectionMembershipMutation(input: {
  client: ShopifyAdminClient;
  storeId: string;
  productId: string;
  collectionId: string;
  payload: AutomationMutationPayload;
}): Promise<MutationExecutionResult> {
  const action = input.payload.collectionAction ?? "add";
  const mutation = action === "remove" ? COLLECTION_REMOVE_PRODUCTS : COLLECTION_ADD_PRODUCTS;
  const field = action === "remove" ? "collectionRemoveProducts" : "collectionAddProducts";

  const result = await shopifyGraphql<{
    collectionAddProducts?: {
      collection: { id: string } | null;
      userErrors: Array<{ field?: string[] | null; message: string }>;
    };
    collectionRemoveProducts?: {
      collection: { id: string } | null;
      userErrors: Array<{ field?: string[] | null; message: string }>;
    };
  }>(
    input.client,
    mutation,
    { id: input.collectionId, productIds: [input.productId] },
    { storeId: input.storeId },
  );

  const payload = result.data[field as keyof typeof result.data];
  assertNoUserErrors(payload?.userErrors, action === "remove" ? "collection_missing" : "graphql_user_error");

  return {
    mutationType: "collection_membership",
    shopifyRequestId: result.requestId,
    oldValues: {
      collectionMembership: {
        collectionId: input.collectionId,
        action,
        productId: input.productId,
      },
    },
    newValues: {
      collectionMembership: {
        collectionId: input.collectionId,
        action,
        productId: input.productId,
        applied: true,
      },
    },
    appliedChanges: [`collectionMembership: ${action} ${input.productId} ${action === "add" ? "to" : "from"} ${input.collectionId}`],
  };
}
