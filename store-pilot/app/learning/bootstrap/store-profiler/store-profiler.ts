import type { StoreSyncAdminClient } from "../../../services/store.server";
import type { StoreCatalogSnapshot } from "../../shared/types";

const STORE_PROFILE_QUERY = `#graphql
  query StorePilotBootstrapProfile {
    shop {
      createdAt
    }
    productsCount {
      count
    }
    productVariantsCount {
      count
    }
    collectionsCount {
      count
    }
    ordersCount {
      count
    }
    locationsCount {
      count
    }
    productTags(first: 250) {
      nodes
    }
    products(first: 25) {
      nodes {
        vendor
        variantsCount {
          count
        }
      }
    }
    orders(first: 1, sortKey: CREATED_AT, reverse: false) {
      nodes {
        createdAt
      }
    }
    recentOrders: orders(first: 1, sortKey: CREATED_AT, reverse: true) {
      nodes {
        createdAt
      }
    }
  }
`;

type ProfileQueryResponse = {
  data?: {
    shop?: { createdAt?: string | null };
    productsCount?: { count?: number | null };
    productVariantsCount?: { count?: number | null };
    collectionsCount?: { count?: number | null };
    ordersCount?: { count?: number | null };
    locationsCount?: { count?: number | null };
    productTags?: { nodes?: string[] | null };
    products?: {
      nodes?: Array<{
        vendor?: string | null;
        variantsCount?: { count?: number | null };
      } | null> | null;
    };
    orders?: { nodes?: Array<{ createdAt?: string | null } | null> | null };
    recentOrders?: { nodes?: Array<{ createdAt?: string | null } | null> | null };
  };
  errors?: Array<{ message?: string }>;
};

export async function collectStoreCatalogSnapshot(
  admin: StoreSyncAdminClient,
): Promise<StoreCatalogSnapshot> {
  const response = await admin.graphql(STORE_PROFILE_QUERY);
  const payload = (await response.json()) as ProfileQueryResponse;

  if (payload.errors?.length) {
    throw new Error(`bootstrap_profile_query_failed:${payload.errors[0]?.message ?? "unknown"}`);
  }

  const data = payload.data;
  const productsCount = data?.productsCount?.count ?? 0;
  const variantsCount = data?.productVariantsCount?.count ?? 0;
  const productNodes = data?.products?.nodes ?? [];
  const vendors = new Set(
    productNodes
      .map((node) => node?.vendor?.trim())
      .filter((vendor): vendor is string => Boolean(vendor)),
  );
  const variantSamples = productNodes
    .map((node) => node?.variantsCount?.count ?? 0)
    .filter((count) => count > 0);
  const averageVariantsPerProduct =
    variantSamples.length > 0
      ? variantSamples.reduce((sum, count) => sum + count, 0) / variantSamples.length
      : productsCount > 0
        ? variantsCount / productsCount
        : 0;

  const storeCreatedAt = parseDate(data?.shop?.createdAt);
  const oldestOrderAt = parseDate(data?.orders?.nodes?.[0]?.createdAt);
  const newestOrderAt = parseDate(data?.recentOrders?.nodes?.[0]?.createdAt);
  const storeAgeDays = storeCreatedAt
    ? Math.max(0, Math.floor((Date.now() - storeCreatedAt.getTime()) / 86400000))
    : 0;
  const estimatedHistoryMonths = estimateHistoryMonths(oldestOrderAt, newestOrderAt, storeCreatedAt);

  return {
    productsCount,
    variantsCount,
    collectionsCount: data?.collectionsCount?.count ?? 0,
    ordersCount: data?.ordersCount?.count ?? 0,
    inventoryItemsCount: variantsCount,
    locationsCount: data?.locationsCount?.count ?? 0,
    vendorsCount: vendors.size,
    uniqueTagsCount: data?.productTags?.nodes?.length ?? 0,
    averageVariantsPerProduct: round(averageVariantsPerProduct, 2),
    oldestOrderAt,
    newestOrderAt,
    storeCreatedAt,
    estimatedHistoryMonths,
    storeAgeDays,
  };
}

function estimateHistoryMonths(
  oldestOrderAt: Date | null,
  newestOrderAt: Date | null,
  storeCreatedAt: Date | null,
): number {
  const anchor = oldestOrderAt ?? storeCreatedAt;
  if (!anchor) {
    return 12;
  }
  const end = newestOrderAt ?? new Date();
  const months = Math.max(
    1,
    Math.ceil((end.getTime() - anchor.getTime()) / (30 * 86400000)),
  );
  return Math.min(months, 120);
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
