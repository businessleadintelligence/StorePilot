import type { Session } from "@shopify/shopify-api";

import { authenticate } from "../shopify.server";

type AdminAuthResult = Awaited<ReturnType<typeof authenticate.admin>>;

const authByRequest = new WeakMap<Request, Promise<AdminAuthResult>>();

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
