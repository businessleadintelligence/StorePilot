import type { ActionFunctionArgs } from "react-router";

import { handleProductUpdateWebhook } from "../services/product.server";
import { validateWebhookRequest } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload, webhookId } = await validateWebhookRequest(request);

  try {
    await handleProductUpdateWebhook({ shop, topic, payload, webhookId });
  } catch {
    return new Response(undefined, { status: 500 });
  }

  return new Response();
};
