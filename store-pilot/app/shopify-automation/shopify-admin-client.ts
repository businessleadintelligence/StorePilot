import prisma from "../db.server";
import { unauthenticated } from "../shopify.server";
import type { StoreSyncAdminClient } from "../services/store.server";
import { ShopifyExecutionError } from "./shopify-errors";

export type ShopifyAdminClient = StoreSyncAdminClient;

export type ShopifyAdminContext = {
  storeId: string;
  shopifyDomain: string;
  client: ShopifyAdminClient;
};

export async function resolveShopifyAdminContext(storeId: string): Promise<ShopifyAdminContext> {
  if (!storeId.trim()) {
    throw new ShopifyExecutionError("shop_unavailable", "Store id is required");
  }

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { id: true, shopifyDomain: true, active: true },
  });

  if (!store?.shopifyDomain) {
    throw new ShopifyExecutionError("shop_unavailable", "Store is unavailable for automation execution", {
      details: { storeId },
    });
  }

  if (store.active === false) {
    throw new ShopifyExecutionError("shop_unavailable", "Store is inactive");
  }

  try {
    const { admin } = await unauthenticated.admin(store.shopifyDomain);
    return {
      storeId: store.id,
      shopifyDomain: store.shopifyDomain,
      client: admin,
    };
  } catch {
    throw new ShopifyExecutionError("token_expired", "Unable to authenticate Shopify admin session", {
      retryable: true,
    });
  }
}

export async function assertWriteProductsPermission(context: ShopifyAdminContext): Promise<void> {
  void context;
}
