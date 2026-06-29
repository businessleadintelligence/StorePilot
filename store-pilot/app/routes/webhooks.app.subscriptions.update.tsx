import type { ActionFunctionArgs } from "react-router";

import { handleBillingSubscriptionWebhook } from "../billing/billing-service";
import {
  buildWebhookActionResponse,
  buildWebhookCatchResponse,
  finalizeWebhookClaim,
  gateWebhookEvent,
  lookupStoreForWebhook,
} from "../services/webhook.server";
import { validateWebhookRequest } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload, webhookId } = await validateWebhookRequest(request);

  if (topic !== "APP_SUBSCRIPTIONS_UPDATE") {
    return buildWebhookActionResponse({});
  }

  const lookup = await lookupStoreForWebhook(shop);
  if (!lookup) {
    return buildWebhookActionResponse({ retryable: true, reason: "store_not_found" });
  }

  const gate = await gateWebhookEvent({
    shop,
    topic,
    webhookId,
    lookup,
  });

  if (gate.outcome === "duplicate") {
    return buildWebhookActionResponse({});
  }

  if (gate.outcome === "inactive_retry") {
    return buildWebhookActionResponse({ retryable: true, reason: "store_inactive_retry" });
  }

  if (gate.outcome === "lease_retry") {
    return buildWebhookActionResponse({ retryable: true, reason: gate.reason });
  }

  if (gate.outcome !== "ready") {
    return buildWebhookActionResponse({ retryable: true, reason: "webhook_not_ready" });
  }

  try {
    const subscription = (payload as { app_subscription?: { name?: string; status?: string } })
      .app_subscription;

    if (subscription?.name && subscription?.status) {
      await handleBillingSubscriptionWebhook({
        storeId: gate.storeId,
        planName: subscription.name,
        status: subscription.status,
      });
    }

    await finalizeWebhookClaim(gate.eventId, true, gate.processingOwner);
    return buildWebhookActionResponse({});
  } catch (error) {
    await finalizeWebhookClaim(gate.eventId, false, gate.processingOwner);
    return buildWebhookCatchResponse(error);
  }
};
