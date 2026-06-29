import type { ActionFunctionArgs } from "react-router";

import { handleOrderUpdatedWebhook } from "../services/orders.server";
import { buildWebhookActionResponse, buildWebhookCatchResponse } from "../services/webhook.server";
import { validateWebhookRequest } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload, webhookId } = await validateWebhookRequest(request);

  try {
    const result = await handleOrderUpdatedWebhook({
      shop,
      topic,
      payload,
      webhookId,
    });

    return buildWebhookActionResponse(result);
  } catch (error) {
    return buildWebhookCatchResponse(error);
  }
};
