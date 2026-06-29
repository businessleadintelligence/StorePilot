import { useState } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useLoaderData, useRouteError } from "react-router";

import { CommandCenter } from "../components/command-center/CommandCenter";
import { OnboardingReminderBanner } from "../components/onboarding/OnboardingReminderBanner";
import { ProductDetailDrawer } from "../components/executive/ProductDetailDrawer";
import prisma from "../db.server";
import { createPrismaAIPersistence } from "../ai/persistence/prisma-persistence";
import { updateRecommendationStatus } from "../services/ai-results.server";
import {
  getCommandCenterData,
  resolveMerchantDisplayName,
  serializeCommandCenterForLoader,
} from "../services/command-center.server";
import type { ExecutiveRecommendationView } from "../services/executive-dashboard.server";
import { recordMerchantRecommendationFeedback } from "../services/product-intelligence.server";
import {
  getOnboardingReminders,
  serializeMerchantOnboardingRemindersForLoader,
} from "../onboarding/onboarding-service";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  if (!shop) {
    return { commandCenter: null, onboardingReminders: [] };
  }

  const store = await prisma.store.findUnique({
    where: { shopifyDomain: shop },
    select: { id: true, currency: true, storeName: true },
  });

  if (!store) {
    return { commandCenter: null, onboardingReminders: [] };
  }

  const merchantName = resolveMerchantDisplayName({
    firstName: (session as { firstName?: string | null }).firstName,
    lastName: (session as { lastName?: string | null }).lastName,
    shopName: store.storeName,
  });

  const [commandCenter, onboardingReminders] = await Promise.all([
    getCommandCenterData({
      storeId: store.id,
      currency: store.currency,
      merchantName,
    }).then(serializeCommandCenterForLoader),
    getOnboardingReminders(store.id),
  ]);

  return {
    commandCenter,
    onboardingReminders: serializeMerchantOnboardingRemindersForLoader(onboardingReminders),
  };
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
  const stableId = String(formData.get("stableId") ?? "");
  const subjectKey = String(formData.get("subjectKey") ?? "");

  if (!stableId || !subjectKey) {
    return Response.json({ ok: false, error: "missing_recommendation" }, { status: 400 });
  }

  if (intent === "view") {
    await updateRecommendationStatus({
      storeId: store.id,
      stableId,
      status: "viewed",
    });
    return Response.json({ ok: true });
  }

  if (intent === "implement" || intent === "dismiss" || intent === "snooze" || intent === "ignore") {
    await recordMerchantRecommendationFeedback({
      storeId: store.id,
      subjectKey,
      stableId,
      feedback: intent === "ignore" ? "ignore" : intent,
      persistence: createPrismaAIPersistence(),
      snoozedUntil:
        intent === "snooze"
          ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          : undefined,
    });
    return Response.json({ ok: true });
  }

  return Response.json({ ok: false, error: "unsupported_intent" }, { status: 400 });
};

export default function CommandCenterRoute() {
  const { commandCenter, onboardingReminders } = useLoaderData<typeof loader>();
  const [selectedRecommendation, setSelectedRecommendation] =
    useState<ExecutiveRecommendationView | null>(null);

  if (!commandCenter) {
    return (
      <s-page heading="AI Command Center">
        <s-section>
          <s-paragraph>Store data is not available yet.</s-paragraph>
        </s-section>
      </s-page>
    );
  }

  return (
    <>
      <OnboardingReminderBanner reminders={onboardingReminders} />
      <CommandCenter
        data={commandCenter}
        onOpenRecommendation={(recommendation) => setSelectedRecommendation(recommendation)}
      />
      <ProductDetailDrawer
        recommendation={selectedRecommendation}
        currency={commandCenter.currency}
        onClose={() => setSelectedRecommendation(null)}
      />
    </>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
