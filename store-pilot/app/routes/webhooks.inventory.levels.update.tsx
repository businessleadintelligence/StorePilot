import type { ActionFunctionArgs } from "react-router";

import { handleInventoryLevelUpdateWebhook } from "../services/inventory.server";
import { buildWebhookActionResponse, buildWebhookCatchResponse } from "../services/webhook.server";
import { validateWebhookRequest } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload, webhookId } = await validateWebhookRequest(request);

  try {
    const result = await handleInventoryLevelUpdateWebhook({
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
