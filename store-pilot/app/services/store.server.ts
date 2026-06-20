import type { Session } from "@shopify/shopify-api";

import prisma from "../db.server";

const SHOP_QUERY = `#graphql
  query StorePilotShop {
    shop {
      id
      name
      currencyCode
      ianaTimezone
      myshopifyDomain
    }
  }
`;

export type StoreSyncAdminClient = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

interface ShopQueryResponse {
  data?: {
    shop?: {
      id?: string | null;
      name?: string | null;
      currencyCode?: string | null;
      ianaTimezone?: string | null;
      myshopifyDomain?: string | null;
    } | null;
  };
  errors?: Array<{ message?: string }>;
}

interface ShopMetadata {
  shopifyId: string;
  storeName: string;
  currency: string;
  timezone: string;
  shopifyDomain: string;
}

function logStoreSync(
  level: "info" | "error",
  message: string,
  context: {
    shop: string;
    operation: string;
    storeId?: string;
    reason?: string;
  },
) {
  const payload = { message, ...context };

  if (level === "error") {
    console.error("[store-sync]", payload);
  } else {
    console.info("[store-sync]", payload);
  }
}

async function fetchShopMetadata(
  admin: StoreSyncAdminClient,
  shop: string,
): Promise<ShopMetadata | null> {
  if (process.env.STORE_SYNC_SIMULATE_GRAPHQL_FAILURE === "1") {
    logStoreSync("error", "Simulated GraphQL failure", {
      shop,
      operation: "shop_query",
      reason: "STORE_SYNC_SIMULATE_GRAPHQL_FAILURE",
    });
    return null;
  }

  try {
    const response = await admin.graphql(SHOP_QUERY);
    const body = (await response.json()) as ShopQueryResponse;

    if (body.errors?.length) {
      logStoreSync("error", "Shop GraphQL returned errors", {
        shop,
        operation: "shop_query",
        reason: body.errors.map((error) => error.message ?? "unknown").join("; "),
      });
      return null;
    }

    const shopData = body.data?.shop;
    if (
      !shopData?.id ||
      !shopData.name ||
      !shopData.currencyCode ||
      !shopData.ianaTimezone
    ) {
      logStoreSync("error", "Shop GraphQL missing required fields", {
        shop,
        operation: "shop_query",
        reason: "missing_required_shop_fields",
      });
      return null;
    }

    return {
      shopifyId: shopData.id,
      storeName: shopData.name,
      currency: shopData.currencyCode,
      timezone: shopData.ianaTimezone,
      shopifyDomain: shop,
    };
  } catch (error) {
    logStoreSync("error", "Shop GraphQL request failed", {
      shop,
      operation: "shop_query",
      reason: error instanceof Error ? error.message : "unknown_error",
    });
    return null;
  }
}

export async function upsertStoreFromSession(
  session: Session,
  admin: StoreSyncAdminClient,
): Promise<void> {
  const shop = session.shop;

  if (!shop) {
    logStoreSync("error", "Session missing shop", {
      shop: "unknown",
      operation: "upsert_store",
      reason: "missing_session_shop",
    });
    return;
  }

  if (!session.accessToken) {
    logStoreSync("error", "Session missing access token", {
      shop,
      operation: "upsert_store",
      reason: "missing_access_token",
    });
    return;
  }

  try {
    const metadata = await fetchShopMetadata(admin, shop);
    if (!metadata) {
      return;
    }

    if (process.env.STORE_SYNC_SIMULATE_PRISMA_FAILURE === "1") {
      throw new Error("Simulated Prisma failure (STORE_SYNC_SIMULATE_PRISMA_FAILURE)");
    }

    const store = await prisma.store.upsert({
      where: { shopifyDomain: shop },
      create: {
        shopifyDomain: metadata.shopifyDomain,
        shopifyId: metadata.shopifyId,
        accessToken: session.accessToken,
        storeName: metadata.storeName,
        currency: metadata.currency,
        timezone: metadata.timezone,
        active: true,
      },
      update: {
        shopifyId: metadata.shopifyId,
        accessToken: session.accessToken,
        storeName: metadata.storeName,
        currency: metadata.currency,
        timezone: metadata.timezone,
        active: true,
      },
    });

    logStoreSync("info", "Store upserted", {
      shop,
      operation: "upsert_store",
      storeId: store.id,
    });
  } catch (error) {
    logStoreSync("error", "Store upsert failed", {
      shop,
      operation: "upsert_store",
      reason: error instanceof Error ? error.message : "unknown_error",
    });
  }
}
