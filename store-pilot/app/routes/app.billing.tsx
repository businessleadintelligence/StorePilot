import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { redirect, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { BillingDashboard } from "../components/billing/BillingDashboard";
import {
  getBillingDashboard,
  handleBillingAction,
  serializeBillingDashboardForRoute,
} from "../billing/billing-service";
import {
  authenticateAdminOnce,
  resolveRequestStoreContext,
} from "../lib/request-auth.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const storeContext = await resolveRequestStoreContext(request);

  if (!storeContext) {
    return { billingDashboard: null };
  }

  const billingDashboard = serializeBillingDashboardForRoute(
    await getBillingDashboard(storeContext.storeId),
  );

  return { billingDashboard };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const [{ admin }, storeContext] = await Promise.all([
    authenticateAdminOnce(request),
    resolveRequestStoreContext(request),
  ]);

  if (!storeContext) {
    return Response.json({ ok: false, error: "missing_shop" }, { status: 400 });
  }

  const { shop, storeId } = storeContext;

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  const planSlug = String(formData.get("planSlug") ?? "") || undefined;
  const url = new URL(request.url);

  const result = await handleBillingAction({
    storeId,
    shop,
    intent,
    planSlug,
    admin,
    returnUrl: `${url.origin}/app/billing?billing=confirmed`,
  });

  if (!result.ok) {
    return Response.json(result, { status: 400 });
  }

  if (result.redirectTo) {
    return redirect(result.redirectTo);
  }

  return redirect("/app/billing");
};

export default function BillingRoute() {
  const { billingDashboard } = useLoaderData<typeof loader>();

  if (!billingDashboard) {
    return (
      <s-page heading="Billing">
        <s-section>
          <s-text color="subdued">Store context unavailable.</s-text>
        </s-section>
      </s-page>
    );
  }

  return <BillingDashboard dashboard={billingDashboard} />;
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
