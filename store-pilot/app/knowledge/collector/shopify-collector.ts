import type { StoreSyncAdminClient } from "../../services/store.server";
import type { ShopifyRawOrder, ShopifyRawProduct } from "../mapping/shopify-mapping";
import {
  SHOPIFY_COLLECTOR_PAGE_SIZE,
  SHOPIFY_MAX_RETRIES,
  SHOPIFY_RATE_LIMIT_DELAY_MS,
  SHOPIFY_RETRY_BASE_MS,
} from "../shared/constants";
import type { CollectorCheckpoint } from "../shared/types";

export type ShopifyCollectorOptions = {
  admin: StoreSyncAdminClient;
  batchSize?: number;
  checkpoint?: CollectorCheckpoint;
  updatedSince?: string | null;
};

export type ProductBatchResult = {
  products: ShopifyRawProduct[];
  nextCursor: string | null;
  hasNextPage: boolean;
};

export type OrderBatchResult = {
  orders: ShopifyRawOrder[];
  nextCursor: string | null;
  hasNextPage: boolean;
};

const KNOWLEDGE_PRODUCTS_QUERY = `#graphql
  query KnowledgeProducts($cursor: String, $pageSize: Int!) {
    products(first: $pageSize, after: $cursor, sortKey: UPDATED_AT) {
      edges {
        node {
          id
          title
          handle
          status
          productType
          vendor
          tags
          publishedAt
          createdAt
          updatedAt
          descriptionHtml
          seo { title description }
          collections(first: 10) {
            edges {
              node {
                id
                title
                productsCount { count }
              }
            }
          }
          media(first: 5) {
            edges {
              node {
                id
                alt
                mediaContentType
              }
            }
          }
          variants(first: 100) {
            edges {
              node {
                id
                sku
                price
                compareAtPrice
                inventoryQuantity
                inventoryItem {
                  id
                  tracked
                  unitCost { amount }
                }
              }
            }
          }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const KNOWLEDGE_ORDERS_QUERY = `#graphql
  query KnowledgeOrders($cursor: String, $pageSize: Int!) {
    orders(first: $pageSize, after: $cursor, sortKey: UPDATED_AT) {
      edges {
        node {
          id
          name
          createdAt
          updatedAt
          processedAt
          cancelledAt
          currencyCode
          test
          displayFinancialStatus
          subtotalPriceSet { shopMoney { amount } }
          totalPriceSet { shopMoney { amount } }
          totalRefundedSet { shopMoney { amount } }
          lineItems(first: 50) {
            edges {
              node {
                variant { id }
              }
            }
          }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

export class ShopifyKnowledgeCollector {
  constructor(private readonly options: ShopifyCollectorOptions) {}

  async collectProductBatch(): Promise<ProductBatchResult> {
    const pageSize = Math.min(
      this.options.batchSize ?? SHOPIFY_COLLECTOR_PAGE_SIZE,
      SHOPIFY_COLLECTOR_PAGE_SIZE,
    );
    const cursor = this.options.checkpoint?.productCursor ?? null;

    const response = await this.graphqlWithRetry<{
      products?: {
        edges?: Array<{ node?: ShopifyRawProduct }>;
        pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
      };
    }>(KNOWLEDGE_PRODUCTS_QUERY, { cursor, pageSize });

    const edges = response.products?.edges ?? [];
    const products = edges
      .map((edge) => edge.node)
      .filter((node): node is ShopifyRawProduct => Boolean(node));

    return {
      products,
      nextCursor: response.products?.pageInfo?.endCursor ?? null,
      hasNextPage: response.products?.pageInfo?.hasNextPage ?? false,
    };
  }

  async collectOrderBatch(): Promise<OrderBatchResult> {
    const pageSize = Math.min(
      this.options.batchSize ?? SHOPIFY_COLLECTOR_PAGE_SIZE,
      SHOPIFY_COLLECTOR_PAGE_SIZE,
    );
    const cursor = this.options.checkpoint?.orderCursor ?? null;

    const response = await this.graphqlWithRetry<{
      orders?: {
        edges?: Array<{ node?: ShopifyRawOrder }>;
        pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
      };
    }>(KNOWLEDGE_ORDERS_QUERY, { cursor, pageSize });

    const edges = response.orders?.edges ?? [];
    const orders = edges
      .map((edge) => edge.node)
      .filter((node): node is ShopifyRawOrder => Boolean(node));

    return {
      orders,
      nextCursor: response.orders?.pageInfo?.endCursor ?? null,
      hasNextPage: response.orders?.pageInfo?.hasNextPage ?? false,
    };
  }

  private async graphqlWithRetry<T>(
    query: string,
    variables: Record<string, unknown>,
  ): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= SHOPIFY_MAX_RETRIES; attempt += 1) {
      try {
        const response = await this.options.admin.graphql(query, { variables });
        const json = (await response.json()) as {
          data?: T;
          errors?: Array<{ message?: string }>;
        };
        if (json.errors?.length) {
          const message = json.errors.map((entry) => entry.message).join("; ");
          if (message.includes("429") || message.toLowerCase().includes("throttled")) {
            throw new Error("rate_limited");
          }
          throw new Error(message);
        }
        if (!json.data) {
          throw new Error("empty_graphql_response");
        }
        return json.data;
      } catch (error) {
        lastError = error;
        if (attempt >= SHOPIFY_MAX_RETRIES) {
          break;
        }
        const delay =
          SHOPIFY_RETRY_BASE_MS * 2 ** (attempt - 1) + SHOPIFY_RATE_LIMIT_DELAY_MS;
        await sleep(delay);
      }
    }
    throw lastError;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createShopifyKnowledgeCollector(
  options: ShopifyCollectorOptions,
): ShopifyKnowledgeCollector {
  return new ShopifyKnowledgeCollector(options);
}
