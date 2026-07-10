import type { ActionFunctionArgs } from "react-router";

import { validateWebhookRequest } from "../shopify.server";
import { handleAppUninstalledWebhook } from "../services/store.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, webhookId } = await validateWebhookRequest(request);
  const webhookTriggeredAtHeader = request.headers.get("X-Shopify-Triggered-At");
  const webhookTriggeredAt = webhookTriggeredAtHeader
    ? new Date(webhookTriggeredAtHeader)
    : undefined;

  console.log(`Received ${topic} webhook for ${shop}`);

  const result = await handleAppUninstalledWebhook({
    shop,
    topic,
    webhookId: webhookId ?? `${shop}:${topic}:${Date.now()}`,
    webhookTriggeredAt:
      webhookTriggeredAt && !Number.isNaN(webhookTriggeredAt.getTime())
        ? webhookTriggeredAt
        : undefined,
  });

  if (!result.success) {
    if (result.retryable) {
      return new Response(result.reason ?? "retryable_uninstall_failure", {
        status: 500,
      });
    }

    return new Response(result.reason ?? "uninstall_failed", { status: 422 });
  }

  return new Response();
};
