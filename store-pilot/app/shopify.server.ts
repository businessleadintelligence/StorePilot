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
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";
import { upsertStoreFromSession } from "./services/store.server";
import { upsertOwnerFromSession } from "./services/user.server";
import { scheduleBootstrapProductSync } from "./services/product.server";

const shopifyAppConfig = {
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.October25,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
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
      try {
        await upsertStoreFromSession(session, admin);
      } catch (error) {
        console.error("[store-sync]", {
          shop: session.shop ?? "unknown",
          operation: "after_auth",
          reason: error instanceof Error ? error.message : "unknown_error",
        });
      }

      try {
        await upsertOwnerFromSession(session, admin);
      } catch (error) {
        console.error("[user-sync]", {
          shop: session.shop ?? "unknown",
          operation: "after_auth",
          reason: error instanceof Error ? error.message : "unknown_error",
        });
      }

      if (session.shop) {
        scheduleBootstrapProductSync({
          shop: session.shop,
          admin,
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
const shopify = shopifyApp(shopifyAppConfig);

export type ValidatedWebhookRequest = {
  shop: string;
  topic: string;
  payload: Record<string, unknown>;
  webhookId: string;
};

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

  if (check.webhookType === WebhookType.Webhooks) {
    return {
      shop: check.domain,
      topic: check.topic,
      payload,
      webhookId: check.webhookId,
    };
  }

  return {
    shop: check.domain,
    topic: check.topic,
    payload,
    webhookId: check.eventId,
  };
}

export default shopify;
export const apiVersion = ApiVersion.October25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
