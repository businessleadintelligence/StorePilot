import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import {
  WebhookType,
  WebhookValidationErrorReason,
  shopifyApi,
  type Session,
  type Shopify,
} from "@shopify/shopify-api";

import prisma from "./db.server";
import { SHOPIFY_ADMIN_API_VERSION_STRING } from "./shopify-api-version.server";
import {
  BootstrapSubscriptionError,
  ensureSubscriptionForActiveStore,
} from "./services/billing.server";
import { EncryptedPrismaSessionStorage } from "./services/encrypted-session-storage.server";
import {
  advanceOnboarding,
  getOrCreateStoreOnboarding,
} from "./services/onboarding.server";
import { ensureOrdersSchedulerActive } from "./services/orders-scheduler.server";
import { bootstrapIntelligenceAfterAuth } from "./learning/scheduler/learning-bootstrap-scheduler";
import { ensureStoreBackfillAfterReinstall } from "./services/store-backfill.server";
import { upsertStoreFromSession } from "./services/store.server";
import { upsertOwnerFromSession } from "./services/user.server";

const LOG_PREFIX = "[after-auth]";

type LogLevel = "info" | "error";

type AfterAuthLogContext = {
  shop: string;
  storeId?: string;
  operation:
    | "onboarding_initialized"
    | "onboarding_advanced"
    | "onboarding_skipped"
    | "onboarding_failed"
    | "webhook_registration_required";
  reason?: string;
  action?: string;
  phase?: string | null;
  jobId?: string;
};

function logAfterAuth(
  level: LogLevel,
  message: string,
  context: AfterAuthLogContext,
): void {
  const payload = { message, ...context };

  if (level === "error") {
    console.error(LOG_PREFIX, payload);
    return;
  }

  console.info(LOG_PREFIX, payload);
}

let shopifyAppInstance: ReturnType<typeof shopifyApp>; // eslint-disable-line prefer-const -- assigned after config for afterAuth hook

const shopifyAppConfig = {
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.October25,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new EncryptedPrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  future: {
    expiringOfflineAccessTokens: true,
  },
  hooks: {
    afterAuth: async ({
      session,
      admin,
    }: {
      session: Session;
      admin: Parameters<typeof upsertStoreFromSession>[1];
    }) => {
      if (!session.shop) {
        logAfterAuth("error", "Session missing shop during afterAuth bootstrap", {
          shop: "unknown",
          operation: "onboarding_skipped",
          reason: "missing_session_shop",
        });
        return;
      }

      try {
        await upsertStoreFromSession(session, admin);
      } catch (error) {
        logAfterAuth("error", "Store upsert failed during afterAuth bootstrap", {
          shop: session.shop,
          operation: "onboarding_skipped",
          reason:
            error instanceof Error ? error.message : "store_upsert_failed",
        });
        return;
      }

      try {
        await shopifyAppInstance.registerWebhooks({ session });
      } catch (error) {
        logAfterAuth("error", "Webhook runtime registration failed; continuing bootstrap", {
          shop: session.shop,
          operation: "webhook_registration_required",
          reason: error instanceof Error ? error.message : "webhook_registration_failed",
        });
      }

      try {
        await upsertOwnerFromSession(session, admin);
      } catch (error) {
        console.error("[user-sync]", {
          shop: session.shop,
          operation: "after_auth",
          reason: error instanceof Error ? error.message : "unknown_error",
        });
      }

      try {
        const store = await prisma.store.findUnique({
          where: { shopifyDomain: session.shop },
          select: { id: true, active: true },
        });

        if (!store?.active) {
          logAfterAuth("error", "Store is not eligible for onboarding bootstrap", {
            shop: session.shop,
            operation: "onboarding_skipped",
            reason: !store ? "store_not_found" : "store_inactive",
          });
          return;
        }

        await ensureSubscriptionForActiveStore(store.id);
        await getOrCreateStoreOnboarding(store.id);
        await ensureStoreBackfillAfterReinstall(store.id);
        await ensureOrdersSchedulerActive(store.id);

        try {
          await bootstrapIntelligenceAfterAuth({ storeId: store.id, admin });
        } catch (error) {
          logAfterAuth("error", "Bootstrap intelligence profiling failed; continuing onboarding", {
            shop: session.shop,
            storeId: store.id,
            operation: "onboarding_initialized",
            reason: error instanceof Error ? error.message : "bootstrap_intelligence_failed",
          });
        }

        logAfterAuth("info", "Store onboarding initialized", {
          shop: session.shop,
          storeId: store.id,
          operation: "onboarding_initialized",
        });

        const advanceResult = await advanceOnboarding({ storeId: store.id });
        logAfterAuth("info", "Store onboarding advanced", {
          shop: session.shop,
          storeId: store.id,
          operation: "onboarding_advanced",
          action: advanceResult.action,
          phase: advanceResult.phase,
          jobId: advanceResult.jobId,
        });
      } catch (error) {
        const reason =
          error instanceof BootstrapSubscriptionError
            ? error.reason
            : error instanceof Error
              ? error.message
              : "unknown_error";

        logAfterAuth("error", "Store onboarding bootstrap failed", {
          shop: session.shop,
          operation: "onboarding_failed",
          reason,
        });
      }
    },
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
};

function createWebhookValidationApi(
  config: typeof shopifyAppConfig,
): Shopify {
  const appUrl = new URL(config.appUrl);
  if (appUrl.hostname === "localhost" && !appUrl.port && process.env.PORT) {
    appUrl.port = process.env.PORT;
  }

  return shopifyApi({
    ...config,
    appUrl: appUrl.origin,
    hostName: appUrl.host,
    hostScheme: appUrl.protocol.replace(":", "") as "http" | "https",
    isEmbeddedApp: true,
    isCustomStoreApp: config.distribution === AppDistribution.ShopifyAdmin,
    future: { unstable_managedPricingSupport: true },
    _logDisabledFutureFlags: false,
  });
}

const webhookValidationApi = createWebhookValidationApi(shopifyAppConfig);
shopifyAppInstance = shopifyApp(shopifyAppConfig);
const shopify = shopifyAppInstance;

export type ValidatedWebhookRequest = {
  shop: string;
  topic: string;
  payload: Record<string, unknown>;
  webhookId: string;
  webhookTriggeredAt?: Date;
};

function parseWebhookTriggeredAt(request: Request): Date | undefined {
  const raw = request.headers.get("X-Shopify-Triggered-At");

  if (!raw) {
    return undefined;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed;
}

export async function validateWebhookRequest(
  request: Request,
): Promise<ValidatedWebhookRequest> {
  if (request.method !== "POST") {
    throw new Response(undefined, {
      status: 405,
      statusText: "Method not allowed",
    });
  }

  const rawBody = await request.text();

  const check = await webhookValidationApi.webhooks.validate({
    rawBody,
    rawRequest: request,
  });

  if (!check.valid) {
    if (check.reason === WebhookValidationErrorReason.InvalidHmac) {
      throw new Response(undefined, {
        status: 401,
        statusText: "Unauthorized",
      });
    }

    throw new Response(undefined, {
      status: 400,
      statusText: "Bad Request",
    });
  }

  const payload = JSON.parse(rawBody) as Record<string, unknown>;
  const webhookTriggeredAt = parseWebhookTriggeredAt(request);

  if (check.webhookType === WebhookType.Webhooks) {
    return {
      shop: check.domain,
      topic: check.topic,
      payload,
      webhookId: check.webhookId,
      webhookTriggeredAt,
    };
  }

  return {
    shop: check.domain,
    topic: check.topic,
    payload,
    webhookId: check.eventId,
    webhookTriggeredAt,
  };
}

export default shopify;
export const apiVersion = ApiVersion.October25;
export const apiVersionString = SHOPIFY_ADMIN_API_VERSION_STRING;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
