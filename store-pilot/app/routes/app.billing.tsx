import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { redirect, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { BillingDashboard } from "../components/billing/BillingDashboard";
import {
  getBillingDashboard,
  handleBillingAction,
  serializeBillingDashboardForRoute,
} from "../billing/billing-service";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  if (!shop) {
    return { billingDashboard: null };
  }

  const store = await prisma.store.findUnique({
    where: { shopifyDomain: shop },
    select: { id: true },
  });

  if (!store) {
    return { billingDashboard: null };
  }

  const billingDashboard = serializeBillingDashboardForRoute(
    await getBillingDashboard(store.id),
  );

  return { billingDashboard };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  if (!shop) {
    return Response.json({ ok: false, error: "missing_shop" }, { status: 400 });
  }

  const store = await prisma.store.findUnique({
    where: { shopifyDomain: shop },
    select: { id: true },
  });

  if (!store) {
    return Response.json({ ok: false, error: "missing_store" }, { status: 404 });
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  const planSlug = String(formData.get("planSlug") ?? "") || undefined;
  const url = new URL(request.url);

  const result = await handleBillingAction({
    storeId: store.id,
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
