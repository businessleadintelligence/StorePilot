import type { LoaderFunctionArgs } from "react-router";

import { buildWebsitePricingModel } from "../billing/website-pricing.server";

export async function loader(_args: LoaderFunctionArgs) {
  return Response.json(buildWebsitePricingModel(), {
    headers: {
      "Cache-Control": "public, max-age=300",
    },
  });
}
