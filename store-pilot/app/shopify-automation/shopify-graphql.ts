import type { ShopifyAdminClient } from "./shopify-admin-client";
import { executeWithRateLimit } from "./shopify-rate-limit";
import { ShopifyExecutionError } from "./shopify-errors";

export type ShopifyGraphqlResult<T> = {
  data: T;
  requestId: string | null;
};

type GraphqlBody<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

export async function shopifyGraphql<T>(
  client: ShopifyAdminClient,
  query: string,
  variables: Record<string, unknown> | undefined,
  options: { storeId?: string },
): Promise<ShopifyGraphqlResult<T>> {
  const response = await executeWithRateLimit(async () => {
    const res = await client.graphql(query, variables ? { variables } : undefined);

    if (res.status === 429) {
      throw new ShopifyExecutionError("rate_limited", "Shopify rate limit exceeded", { retryable: true });
    }
    if (res.status === 401 || res.status === 403) {
      throw new ShopifyExecutionError("permission_denied", "Shopify permission denied");
    }
    if (res.status >= 500) {
      throw new ShopifyExecutionError("network_timeout", "Shopify service unavailable", { retryable: true });
    }
    if (!res.ok) {
      throw new ShopifyExecutionError("network_timeout", `Shopify request failed with status ${res.status}`, {
        retryable: res.status >= 500,
      });
    }

    return res;
  }, { storeId: options.storeId });

  const requestId = response.headers.get("x-request-id");
  const body = (await response.json()) as GraphqlBody<T>;

  if (body.errors?.length) {
    throw new ShopifyExecutionError("graphql_user_error", body.errors.map((error) => error.message).join("; "), {
      details: { errors: body.errors.map((error) => error.message) },
    });
  }

  if (!body.data) {
    throw new ShopifyExecutionError("graphql_user_error", "Shopify GraphQL response missing data");
  }

  return { data: body.data, requestId };
}

export function assertNoUserErrors(
  userErrors: Array<{ field?: string[] | null; message: string }> | undefined,
  code: ShopifyExecutionError["code"] = "graphql_user_error",
): void {
  if (!userErrors?.length) return;
  throw new ShopifyExecutionError(code, userErrors.map((error) => error.message).join("; "), {
    details: { userErrors: userErrors.map((error) => error.message) },
  });
}

export const PRODUCT_SNAPSHOT_QUERY = `#graphql
  query AutomationProductSnapshot($id: ID!) {
    product(id: $id) {
      id
      tags
      productType
      status
      seo {
        title
        description
      }
      variants(first: 1) {
        edges {
          node {
            id
            price
            compareAtPrice
          }
        }
      }
    }
  }
`;

export type ProductSnapshot = {
  id: string;
  tags: string[];
  productType: string;
  status: string;
  seo: { title: string | null; description: string | null } | null;
  variants: {
    edges: Array<{
      node: {
        id: string;
        price: string;
        compareAtPrice: string | null;
      };
    }>;
  };
};

export async function readProductSnapshot(
  client: ShopifyAdminClient,
  productId: string,
  storeId: string,
): Promise<ProductSnapshot> {
  const result = await shopifyGraphql<{ product: ProductSnapshot | null }>(
    client,
    PRODUCT_SNAPSHOT_QUERY,
    { id: productId },
    { storeId },
  );

  if (!result.data.product) {
    throw new ShopifyExecutionError("product_missing", "Product not found in Shopify", {
      details: { productId },
    });
  }

  return result.data.product;
}
