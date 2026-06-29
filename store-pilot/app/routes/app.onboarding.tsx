import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { redirect, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { OnboardingWizard } from "../components/onboarding/OnboardingWizard";
import prisma from "../db.server";
import { handleOnboardingAction } from "../onboarding/onboarding-actions";
import {
  getMerchantOnboardingDashboard,
  serializeMerchantOnboardingForLoader,
} from "../onboarding/onboarding-service";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  if (!shop) {
    return { onboardingDashboard: null };
  }

  const store = await prisma.store.findUnique({
    where: { shopifyDomain: shop },
    select: { id: true },
  });

  if (!store) {
    return { onboardingDashboard: null };
  }

  const dashboard = serializeMerchantOnboardingForLoader(
    await getMerchantOnboardingDashboard(store.id),
  );

  return { onboardingDashboard: dashboard };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
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
  const stepId = String(formData.get("stepId") ?? "") || undefined;

  const result = await handleOnboardingAction({
    storeId: store.id,
    shop,
    intent,
    stepId: stepId as never,
    formData,
  });

  if (!result.ok) {
    return Response.json(result, { status: 400 });
  }

  if (result.redirectTo) {
    if (result.redirectTo.startsWith("http")) {
      return redirect(result.redirectTo);
    }
    return redirect(result.redirectTo);
  }

  return redirect("/app/onboarding");
};

export default function OnboardingRoute() {
  const { onboardingDashboard } = useLoaderData<typeof loader>();

  if (!onboardingDashboard) {
    return (
      <s-page heading="StorePilot Setup">
        <s-section>
          <s-text color="subdued">Store context unavailable.</s-text>
        </s-section>
      </s-page>
    );
  }

  return <OnboardingWizard dashboard={onboardingDashboard} />;
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
