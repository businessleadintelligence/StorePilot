import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import prisma from "../db.server";
import { syncProductsFromShopify } from "../services/product.server";
import { authenticate } from "../shopify.server";

function devOnlyResponse(): Response | null {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return null;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const blocked = devOnlyResponse();
  if (blocked) {
    return blocked;
  }

  if (request.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  return Response.json({
    route: "/app/dev/sync-products",
    method: "POST",
    note: "Development-only manual product sync trigger",
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const blocked = devOnlyResponse();
  if (blocked) {
    return blocked;
  }

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  if (!shop) {
    return Response.json({ error: "Missing shop session" }, { status: 400 });
  }

  const store = await prisma.store.findUnique({
    where: { shopifyDomain: shop },
    select: { id: true, active: true },
  });

  if (!store?.active) {
    return Response.json({ error: "Store not active" }, { status: 404 });
  }

  const result = await syncProductsFromShopify({
    storeId: store.id,
    shop,
    admin,
  });

  return Response.json(result);
};
