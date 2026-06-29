import type { ActionFunctionArgs } from "react-router";

import { handleCustomersRedactWebhook } from "../services/gdpr.server";
import { buildWebhookCatchResponse } from "../services/webhook.server";
import { validateWebhookRequest } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload, webhookId } = await validateWebhookRequest(request);

  try {
    await handleCustomersRedactWebhook({ shop, topic, payload, webhookId });
  } catch (error) {
    return buildWebhookCatchResponse(error);
  }

  return new Response();
};
