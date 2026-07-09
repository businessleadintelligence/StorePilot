import type { Session } from "@shopify/shopify-api";

import prisma from "../db.server";
import {
  encryptSecretToken,
} from "./token-crypto.server";
import { terminateSubscriptionOnUninstall } from "./billing.server";
import { cancelStoreJobsOnUninstall } from "./job.server";
import {
  claimWebhookEvent,
  finalizeWebhookClaim,
  isClaimDuplicate,
  isClaimRetryable,
  lookupStoreForWebhook,
} from "./webhook.server";

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

function logStoreDeactivate(
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
    console.error("[store-deactivate]", payload);
  } else {
    console.info("[store-deactivate]", payload);
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

export class StoreUpsertError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(reason);
    this.name = "StoreUpsertError";
    this.reason = reason;
  }
}

export type UpsertStoreFromSessionResult = {
  storeId: string;
};

export async function upsertStoreFromSession(
  session: Session,
  admin: StoreSyncAdminClient,
): Promise<UpsertStoreFromSessionResult> {
  const shop = session.shop;

  if (!shop) {
    logStoreSync("error", "Session missing shop", {
      shop: "unknown",
      operation: "upsert_store",
      reason: "missing_session_shop",
    });
    throw new StoreUpsertError("missing_session_shop");
  }

  if (!session.accessToken) {
    logStoreSync("error", "Session missing access token", {
      shop,
      operation: "upsert_store",
      reason: "missing_access_token",
    });
    throw new StoreUpsertError("missing_access_token");
  }

  try {
    const metadata = await fetchShopMetadata(admin, shop);
    if (!metadata) {
      throw new StoreUpsertError("shop_metadata_unavailable");
    }

    if (process.env.STORE_SYNC_SIMULATE_PRISMA_FAILURE === "1") {
      throw new Error("Simulated Prisma failure (STORE_SYNC_SIMULATE_PRISMA_FAILURE)");
    }

    const authenticatedAt = new Date();

    const store = await prisma.store.upsert({
      where: { shopifyDomain: shop },
      create: {
        shopifyDomain: metadata.shopifyDomain,
        shopifyId: metadata.shopifyId,
        accessToken: encryptSecretToken(session.accessToken),
        storeName: metadata.storeName,
        currency: metadata.currency,
        timezone: metadata.timezone,
        active: true,
        lastAuthenticatedAt: authenticatedAt,
      },
      update: {
        shopifyId: metadata.shopifyId,
        accessToken: encryptSecretToken(session.accessToken),
        storeName: metadata.storeName,
        currency: metadata.currency,
        timezone: metadata.timezone,
        active: true,
        lastAuthenticatedAt: authenticatedAt,
      },
    });

    logStoreSync("info", "Store upserted", {
      shop,
      operation: "upsert_store",
      storeId: store.id,
    });

    return { storeId: store.id };
  } catch (error) {
    if (error instanceof StoreUpsertError) {
      logStoreSync("error", "Store upsert failed", {
        shop,
        operation: "upsert_store",
        reason: error.reason,
      });
      throw error;
    }

    logStoreSync("error", "Store upsert failed", {
      shop,
      operation: "upsert_store",
      reason: error instanceof Error ? error.message : "unknown_error",
    });
    throw new StoreUpsertError(
      error instanceof Error ? error.message : "store_upsert_failed",
    );
  }
}

export type AppUninstalledWebhookResult = {
  success: boolean;
  duplicate?: boolean;
  stale?: boolean;
  retryable?: boolean;
  reason?: string;
};

export async function isStaleUninstallWebhook(
  shop: string,
  referenceAt?: Date,
): Promise<boolean> {
  if (!referenceAt) {
    return false;
  }

  const store = await prisma.store.findUnique({
    where: { shopifyDomain: shop },
    select: { lastAuthenticatedAt: true },
  });

  if (!store?.lastAuthenticatedAt) {
    return false;
  }

  return store.lastAuthenticatedAt > referenceAt;
}

async function resolveUninstallStaleReferenceAt(input: {
  shop: string;
  webhookTriggeredAt?: Date;
  eventId?: string;
}): Promise<Date | undefined> {
  if (input.webhookTriggeredAt) {
    return input.webhookTriggeredAt;
  }

  if (!input.eventId) {
    return undefined;
  }

  const event = await prisma.webhookEvent.findUnique({
    where: { id: input.eventId },
    select: { createdAt: true },
  });

  return event?.createdAt;
}

export async function handleAppUninstalledWebhook(input: {
  shop: string;
  topic: string;
  webhookId: string;
  webhookTriggeredAt?: Date;
}): Promise<AppUninstalledWebhookResult> {
  const lookup = await lookupStoreForWebhook(input.shop);

  if (!lookup) {
    try {
      await prisma.session.deleteMany({ where: { shop: input.shop } });
    } catch (error) {
      logStoreDeactivate("error", "Session cleanup failed for missing store", {
        shop: input.shop,
        operation: "uninstall_webhook",
        reason: error instanceof Error ? error.message : "unknown_error",
      });
      return {
        success: false,
        retryable: true,
        reason:
          error instanceof Error ? error.message : "session_cleanup_failed",
      };
    }

    return { success: true };
  }

  const claim = await claimWebhookEvent({
    storeId: lookup.storeId,
    shop: input.shop,
    topic: input.topic,
    webhookId: input.webhookId,
  });

  if (isClaimDuplicate(claim)) {
    return { success: true, duplicate: true };
  }

  if (isClaimRetryable(claim)) {
    return {
      success: false,
      retryable: true,
      reason: claim.reason ?? claim.status,
    };
  }

  try {
    const staleReferenceAt = await resolveUninstallStaleReferenceAt({
      shop: input.shop,
      webhookTriggeredAt: input.webhookTriggeredAt,
      eventId: claim.eventId,
    });

    if (await isStaleUninstallWebhook(input.shop, staleReferenceAt)) {
      await finalizeWebhookClaim(claim.eventId, true, claim.processingOwner);

      logStoreDeactivate("info", "Stale uninstall webhook ignored", {
        shop: input.shop,
        operation: "stale_uninstall_ignored",
        storeId: lookup.storeId,
      });

      return { success: true, stale: true };
    }

    await deactivateStoreOnUninstall(input.shop);
    await prisma.session.deleteMany({ where: { shop: input.shop } });
    await finalizeWebhookClaim(claim.eventId, true, claim.processingOwner);

    logStoreDeactivate("info", "App uninstall processed", {
      shop: input.shop,
      operation: "uninstall_processed",
      storeId: lookup.storeId,
    });

    return { success: true };
  } catch (error) {
    await finalizeWebhookClaim(claim.eventId, false, claim.processingOwner);

    logStoreDeactivate("error", "App uninstall processing failed", {
      shop: input.shop,
      operation: "uninstall_webhook",
      storeId: lookup.storeId,
      reason: error instanceof Error ? error.message : "unknown_error",
    });

    return {
      success: false,
      retryable: true,
      reason: error instanceof Error ? error.message : "deactivation_failed",
    };
  }
}

export async function deactivateStoreOnUninstall(shop: string): Promise<void> {
  if (!shop) {
    throw new Error("retriable_missing_shop");
  }

  const existing = await prisma.store.findUnique({
    where: { shopifyDomain: shop },
    select: { id: true, active: true, accessToken: true },
  });

  if (!existing) {
    return;
  }

  if (!existing.active && existing.accessToken === "") {
    return;
  }

  await prisma.store.update({
    where: { id: existing.id },
    data: {
      active: false,
      accessToken: "",
      ga4RefreshToken: null,
    },
  });

  await terminateSubscriptionOnUninstall(existing.id);
  await cancelStoreJobsOnUninstall(existing.id);

  const { recordBillingLifecycleEvent } = await import("../billing/billing-audit");
  const { clearBillingServiceCache } = await import("../billing/billing-service");
  recordBillingLifecycleEvent(
    existing.id,
    "uninstall_cleanup",
    "Stopped background jobs, disabled connector sync eligibility, preserved billing audit logs",
  );
  clearBillingServiceCache(existing.id);

  logStoreDeactivate("info", "Store deactivated", {
    shop,
    operation: "deactivate_store",
    storeId: existing.id,
  });
}
