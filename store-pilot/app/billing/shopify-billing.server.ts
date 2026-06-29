import prisma from "../db.server";
import { getStoreSubscription } from "../services/billing.server";
import { appendBillingAuditEvent } from "./billing-audit";
import { getCanonicalPlan } from "./billing-limits";
import type { BillingActionResult, BillingPlanSlug } from "./billing-types";
import { getBillingTrialDays } from "./plan-config";
import { shopifyGraphqlWithRetry } from "../services/shopify-graphql-retry.server";

export type ShopifyBillingAdminClient = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

export type ShopifySubscriptionSummary = {
  id: string;
  name: string;
  status: string;
  trialDays: number;
};

export type CreateShopifySubscriptionResult =
  | { ok: true; confirmationUrl: string }
  | { ok: false; error: string; merchantMessage: string };

const APP_SUBSCRIPTION_CREATE = `#graphql
  mutation AppSubscriptionCreate($name: String!, $returnUrl: URL!, $lineItems: [AppSubscriptionLineItemInput!]!, $trialDays: Int, $test: Boolean) {
    appSubscriptionCreate(name: $name, returnUrl: $returnUrl, lineItems: $lineItems, trialDays: $trialDays, test: $test) {
      appSubscription {
        id
        status
      }
      confirmationUrl
      userErrors {
        field
        message
      }
    }
  }
`;

const CURRENT_APP_INSTALLATION = `#graphql
  query CurrentAppInstallationSubscriptions {
    currentAppInstallation {
      activeSubscriptions {
        id
        name
        status
        trialDays
      }
    }
  }
`;

const APP_SUBSCRIPTION_CANCEL = `#graphql
  mutation AppSubscriptionCancel($id: ID!) {
    appSubscriptionCancel(id: $id) {
      appSubscription {
        id
        status
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export function isBillingTestMode(): boolean {
  return process.env.BILLING_TEST_MODE === "1" || process.env.NODE_ENV !== "production";
}

export function mapShopifyBillingError(error: string): string {
  if (/declined|rejected/i.test(error)) {
    return "Merchant declined payment. No charge was created.";
  }
  if (/duplicate|already exists/i.test(error)) {
    return "An active subscription already exists. Manage billing from the Billing page.";
  }
  if (/unavailable|network|timeout/i.test(error)) {
    return "Shopify billing is temporarily unavailable. Please retry in a few minutes.";
  }
  return "Billing could not be completed. Please retry or contact support.";
}

export async function listActiveShopifySubscriptions(
  admin: ShopifyBillingAdminClient,
): Promise<ShopifySubscriptionSummary[]> {
  const response = await shopifyGraphqlWithRetry(admin, CURRENT_APP_INSTALLATION, {});
  const body = (await response.json()) as {
    data?: {
      currentAppInstallation?: {
        activeSubscriptions?: ShopifySubscriptionSummary[];
      };
    };
    errors?: Array<{ message?: string }>;
  };

  if (body.errors?.length) {
    throw new Error(body.errors.map((item) => item.message ?? "graphql_error").join("; "));
  }

  return body.data?.currentAppInstallation?.activeSubscriptions ?? [];
}

export async function hasDuplicateShopifySubscription(
  admin: ShopifyBillingAdminClient,
): Promise<boolean> {
  const active = await listActiveShopifySubscriptions(admin);
  return active.some((item) => item.status === "ACTIVE" || item.status === "PENDING");
}

export async function createShopifySubscriptionCharge(input: {
  admin: ShopifyBillingAdminClient;
  storeId: string;
  shop: string;
  planSlug: BillingPlanSlug;
  returnUrl: string;
  trialDays?: number;
}): Promise<CreateShopifySubscriptionResult> {
  const plan = getCanonicalPlan(input.planSlug);

  if (await hasDuplicateShopifySubscription(input.admin)) {
    return {
      ok: false,
      error: "duplicate_subscription",
      merchantMessage: mapShopifyBillingError("duplicate subscription already exists"),
    };
  }

  const response = await shopifyGraphqlWithRetry(input.admin, APP_SUBSCRIPTION_CREATE, {
    name: `StorePilot ${plan.name}`,
    returnUrl: input.returnUrl,
    trialDays: input.trialDays ?? getBillingTrialDays(input.planSlug),
    test: isBillingTestMode(),
    lineItems: [
      {
        plan: {
          appRecurringPricingDetails: {
            price: { amount: plan.monthlyPriceUsd, currencyCode: "USD" },
            interval: "EVERY_30_DAYS",
          },
        },
      },
    ],
  });

  const body = (await response.json()) as {
    data?: {
      appSubscriptionCreate?: {
        confirmationUrl?: string | null;
        userErrors?: Array<{ message?: string }>;
      };
    };
    errors?: Array<{ message?: string }>;
  };

  if (body.errors?.length) {
    const message = body.errors.map((item) => item.message ?? "graphql_error").join("; ");
    return { ok: false, error: "shopify_api_failure", merchantMessage: mapShopifyBillingError(message) };
  }

  const userErrors = body.data?.appSubscriptionCreate?.userErrors ?? [];
  if (userErrors.length > 0) {
    const message = userErrors.map((item) => item.message ?? "billing_error").join("; ");
    return { ok: false, error: "invalid_charge", merchantMessage: mapShopifyBillingError(message) };
  }

  const confirmationUrl = body.data?.appSubscriptionCreate?.confirmationUrl;
  if (!confirmationUrl) {
    return {
      ok: false,
      error: "billing_unavailable",
      merchantMessage: mapShopifyBillingError("billing unavailable"),
    };
  }

  appendBillingAuditEvent({
    storeId: input.storeId,
    eventType: "subscription_charge_created",
    message: `Shopify billing confirmation created for ${plan.name} at $${plan.monthlyPriceUsd}/month`,
  });

  return { ok: true, confirmationUrl };
}

export async function cancelShopifySubscription(input: {
  admin: ShopifyBillingAdminClient;
  storeId: string;
  subscriptionGid: string;
}): Promise<BillingActionResult> {
  const response = await shopifyGraphqlWithRetry(input.admin, APP_SUBSCRIPTION_CANCEL, {
    id: input.subscriptionGid,
  });

  const body = (await response.json()) as {
    data?: {
      appSubscriptionCancel?: {
        userErrors?: Array<{ message?: string }>;
      };
    };
    errors?: Array<{ message?: string }>;
  };

  if (body.errors?.length || (body.data?.appSubscriptionCancel?.userErrors?.length ?? 0) > 0) {
    const message =
      body.errors?.map((item) => item.message).join("; ") ??
      body.data?.appSubscriptionCancel?.userErrors?.map((item) => item.message).join("; ") ??
      "cancel_failed";
    return { ok: false, error: "cancel_failed", message: mapShopifyBillingError(message) };
  }

  appendBillingAuditEvent({
    storeId: input.storeId,
    eventType: "subscription_cancel_requested",
    message: "Merchant requested subscription cancellation via Shopify Billing API",
  });

  return { ok: true, message: "Subscription cancellation submitted." };
}

export async function syncInternalPlanFromShopify(input: {
  storeId: string;
  planSlug: BillingPlanSlug;
  status: "active" | "trialing" | "cancelled" | "past_due";
}): Promise<void> {
  const plan = await prisma.plan.findUnique({ where: { slug: input.planSlug } });
  if (!plan) {
    return;
  }

  const now = new Date();
  const existing = await getStoreSubscription(input.storeId);

  await prisma.subscription.upsert({
    where: { storeId: input.storeId },
    create: {
      storeId: input.storeId,
      planId: plan.id,
      status: input.status,
      currentPeriodStart: now,
      currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      trialEndsAt:
        input.status === "trialing"
          ? new Date(now.getTime() + getBillingTrialDays(input.planSlug) * 86400000)
          : null,
    },
    update: {
      planId: plan.id,
      status: input.status,
      endedAt: input.status === "cancelled" ? now : null,
    },
  });

  if (existing) {
    appendBillingAuditEvent({
      storeId: input.storeId,
      eventType: "subscription_synced",
      message: `Internal subscription synced to ${input.planSlug} (${input.status})`,
    });
  }
}

export async function handleCommercialUninstall(storeId: string): Promise<void> {
  appendBillingAuditEvent({
    storeId,
    eventType: "commercial_uninstall",
    message: "Commercial billing layer recorded app uninstall — features locked pending reinstall",
  });
}
