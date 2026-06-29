import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { SystemHealthDashboard } from "../components/production/SystemHealthDashboard";
import { OnboardingReminderBanner } from "../components/onboarding/OnboardingReminderBanner";
import prisma from "../db.server";
import {
  getProductionHealthDashboard,
  serializeProductionDashboardForRoute,
} from "../production/production-service";
import {
  getOnboardingReminders,
  serializeMerchantOnboardingRemindersForLoader,
} from "../onboarding/onboarding-service";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  if (!shop) {
    return { systemHealth: null, onboardingReminders: [] };
  }

  const store = await prisma.store.findUnique({
    where: { shopifyDomain: shop },
    select: { id: true },
  });

  if (!store) {
    return { systemHealth: null, onboardingReminders: [] };
  }

  const [dashboard, onboardingReminders] = await Promise.all([
    getProductionHealthDashboard(store.id).then(serializeProductionDashboardForRoute),
    getOnboardingReminders(store.id),
  ]);

  return {
    systemHealth: dashboard,
    onboardingReminders: serializeMerchantOnboardingRemindersForLoader(onboardingReminders),
  };
};

export default function SystemHealthRoute() {
  const { systemHealth, onboardingReminders } = useLoaderData<typeof loader>();

  if (!systemHealth) {
    return (
      <s-page heading="System Health">
        <s-section>
          <s-text color="subdued">Store context unavailable.</s-text>
        </s-section>
      </s-page>
    );
  }

  return (
    <>
      <OnboardingReminderBanner reminders={onboardingReminders} />
      <SystemHealthDashboard dashboard={systemHealth} />
    </>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
