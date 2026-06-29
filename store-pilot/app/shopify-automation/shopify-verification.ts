import type { ShopifyAdminClient } from "./shopify-admin-client";
import { readProductSnapshot, shopifyGraphql } from "./shopify-graphql";
import type { MutationExecutionResult } from "./shopify-mutation-types";
import { ShopifyExecutionError } from "./shopify-errors";

const COLLECTION_PRODUCTS_QUERY = `#graphql
  query AutomationCollectionProducts($id: ID!) {
    collection(id: $id) {
      id
      products(first: 250) {
        edges {
          node {
            id
          }
        }
      }
    }
  }
`;

export async function verifyMutationResult(input: {
  client: ShopifyAdminClient;
  storeId: string;
  productId: string;
  collectionId?: string;
  mutation: MutationExecutionResult;
}): Promise<{ passed: boolean; details: Record<string, unknown> }> {
  switch (input.mutation.mutationType) {
    case "product_tags": {
      const product = await readProductSnapshot(input.client, input.productId, input.storeId);
      const expected = input.mutation.newValues.tags;
      const passed = Array.isArray(expected)
        ? arraysEqual(product.tags, expected.map(String))
        : false;
      return { passed, details: { actualTags: product.tags, expectedTags: expected } };
    }
    case "product_type": {
      const product = await readProductSnapshot(input.client, input.productId, input.storeId);
      const passed = product.productType === String(input.mutation.newValues.productType ?? "");
      return { passed, details: { actualProductType: product.productType } };
    }
    case "seo_metadata": {
      const product = await readProductSnapshot(input.client, input.productId, input.storeId);
      const titleOk =
        input.mutation.newValues.seoTitle === undefined ||
        product.seo?.title === input.mutation.newValues.seoTitle;
      const descriptionOk =
        input.mutation.newValues.seoDescription === undefined ||
        product.seo?.description === input.mutation.newValues.seoDescription;
      return {
        passed: titleOk && descriptionOk,
        details: { seo: product.seo, expected: input.mutation.newValues },
      };
    }
    case "product_status": {
      const product = await readProductSnapshot(input.client, input.productId, input.storeId);
      const passed = product.status === String(input.mutation.newValues.status ?? "");
      return { passed, details: { actualStatus: product.status } };
    }
    case "product_price":
    case "compare_at_price": {
      const product = await readProductSnapshot(input.client, input.productId, input.storeId);
      const variant = product.variants.edges[0]?.node;
      const priceOk =
        input.mutation.newValues.price === undefined ||
        variant?.price === String(input.mutation.newValues.price);
      const compareOk =
        input.mutation.newValues.compareAtPrice === undefined ||
        (variant?.compareAtPrice ?? null) ===
          (input.mutation.newValues.compareAtPrice === null
            ? null
            : String(input.mutation.newValues.compareAtPrice));
      return {
        passed: Boolean(variant) && priceOk && compareOk,
        details: { variant, expected: input.mutation.newValues },
      };
    }
    case "collection_membership": {
      if (!input.collectionId) {
        return { passed: false, details: { reason: "collection_id_missing" } };
      }
      const result = await shopifyGraphql<{
        collection: {
          id: string;
          products: { edges: Array<{ node: { id: string } }> };
        } | null;
      }>(input.client, COLLECTION_PRODUCTS_QUERY, { id: input.collectionId }, { storeId: input.storeId });
      const productIds = result.data.collection?.products.edges.map((edge) => edge.node.id) ?? [];
      const action = (input.mutation.newValues.collectionMembership as { action?: string })?.action;
      const contains = productIds.includes(input.productId);
      const passed = action === "remove" ? !contains : contains;
      return { passed, details: { productIds, action, contains } };
    }
    default:
      return { passed: true, details: { skipped: true } };
  }
}

export async function assertMutationVerified(input: Parameters<typeof verifyMutationResult>[0]): Promise<void> {
  const verification = await verifyMutationResult(input);
  if (!verification.passed) {
    throw new ShopifyExecutionError("verification_failed", "Shopify verification failed after mutation", {
      retryable: true,
      details: verification.details,
    });
  }
}

function arraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((value, index) => value === sortedRight[index]);
}
