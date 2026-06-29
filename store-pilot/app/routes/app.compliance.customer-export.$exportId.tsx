import type { LoaderFunctionArgs } from "react-router";

import prisma from "../db.server";
import { getCustomerDataExportForStore } from "../services/gdpr.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const exportId = params.exportId;

  if (!exportId || !session.shop) {
    throw new Response("Not Found", { status: 404 });
  }

  const store = await prisma.store.findUnique({
    where: { shopifyDomain: session.shop },
    select: { id: true, active: true },
  });

  if (!store?.active) {
    throw new Response("Not Found", { status: 404 });
  }

  const exportPayload = await getCustomerDataExportForStore(exportId, store.id);
  if (!exportPayload) {
    throw new Response("Not Found", { status: 404 });
  }

  return new Response(JSON.stringify(exportPayload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="storepilot-customer-export-${exportId}.json"`,
      "Cache-Control": "no-store",
    },
  });
};

export default function CustomerExportDownloadRoute() {
  return null;
}
