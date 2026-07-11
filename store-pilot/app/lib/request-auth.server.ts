import type { Session } from "@shopify/shopify-api";

import prisma from "../db.server";
import { authenticate } from "../shopify.server";

type AdminAuthResult = Awaited<ReturnType<typeof authenticate.admin>>;

const authByRequest = new WeakMap<Request, Promise<AdminAuthResult>>();

export type RequestStoreRecord = {
  id: string;
  currency: string;
  shopifyDomain: string;
};

export type RequestStoreContext = {
  shop: string;
  store: RequestStoreRecord;
  storeId: string;
  currency: string;
};

const storeContextByRequest = new WeakMap<
  Request,
  Promise<RequestStoreContext | null>
>();

/**
 * Ensures authenticate.admin runs at most once per HTTP request (parent + child loaders).
 */
export function authenticateAdminOnce(request: Request): Promise<AdminAuthResult> {
  let pending = authByRequest.get(request);
  if (!pending) {
    pending = authenticate.admin(request);
    authByRequest.set(request, pending);
  }
  return pending;
}

export function getSessionShop(session: Session | undefined): string | undefined {
  return session?.shop?.trim() || undefined;
}

/**
 * Resolves auth + store once per HTTP request for all nested loaders.
 */
export function resolveRequestStoreContext(
  request: Request,
): Promise<RequestStoreContext | null> {
  let pending = storeContextByRequest.get(request);
  if (!pending) {
    pending = (async () => {
      const { session } = await authenticateAdminOnce(request);
      const shop = getSessionShop(session);
      if (!shop) {
        return null;
      }

      const store = await prisma.store.findUnique({
        where: { shopifyDomain: shop },
        select: { id: true, currency: true, shopifyDomain: true },
      });
      if (!store) {
        return null;
      }

      return {
        shop,
        store: {
          id: store.id,
          currency: store.currency,
          shopifyDomain: store.shopifyDomain,
        },
        storeId: store.id,
        currency: store.currency,
      };
    })();
    storeContextByRequest.set(request, pending);
  }
  return pending;
}
