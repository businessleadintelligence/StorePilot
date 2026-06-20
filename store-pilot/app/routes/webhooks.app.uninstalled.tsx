import type { ActionFunctionArgs } from "react-router";
import { validateWebhookRequest } from "../shopify.server";
import db from "../db.server";
import { deactivateStoreOnUninstall } from "../services/store.server";

function logSessionCleanup(
  level: "info" | "error",
  message: string,
  context: {
    shop: string;
    operation: string;
    deletedCount?: number;
    reason?: string;
  },
) {
  const payload = { message, ...context };

  if (level === "error") {
    console.error("[session-cleanup]", payload);
  } else {
    console.info("[session-cleanup]", payload);
  }
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await validateWebhookRequest(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  await deactivateStoreOnUninstall(shop);

  try {
    const result = await db.session.deleteMany({ where: { shop } });
    logSessionCleanup("info", "Sessions deleted", {
      shop,
      operation: "delete_sessions",
      deletedCount: result.count,
    });
  } catch (error) {
    logSessionCleanup("error", "Session cleanup failed", {
      shop,
      operation: "delete_sessions",
      reason: error instanceof Error ? error.message : "unknown_error",
    });
  }

  return new Response();
};
