import type {
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useLoaderData } from "react-router";

import { GoogleAnalyticsSetupCard } from "../components/GoogleAnalyticsSetupCard";
import { OnboardingReminderBanner } from "../components/onboarding/OnboardingReminderBanner";
import { ExecutiveBriefCard } from "../components/ExecutiveBriefCard";
import { HealthScoreCard } from "../components/HealthScoreCard";
import { InsightsCard } from "../components/InsightsCard";
import { MetricsOverviewCard } from "../components/MetricsOverviewCard";
import { OnboardingCard } from "../components/OnboardingCard";
import { RecommendationsCard } from "../components/RecommendationsCard";
import { SyncStatusCard } from "../components/SyncStatusCard";
import prisma from "../db.server";
import {
  calculateExecutiveBrief,
  serializeExecutiveBriefForLoader,
} from "../services/executive-brief.server";
import {
  calculateStoreHealthScore,
  serializeHealthScoreForLoader,
} from "../services/health-score.server";
import {
  getOnboardingStatus,
  serializeOnboardingForLoader,
} from "../services/onboarding-ui.server";
import { shouldShowOnboardingCardFromLoader } from "../lib/onboarding-display";
import {
  getStoreMetrics,
  serializeMetricsForLoader,
} from "../services/metrics.server";
import {
  buildStoreInsights,
  serializeInsightsForLoader,
} from "../services/insights.server";
import {
  buildStoreRecommendations,
  serializeRecommendationsForLoader,
} from "../services/recommendations.server";
import {
  getStoreSyncStatus,
  serializeStoreSyncStatusForLoader,
} from "../services/sync-status.server";
import { getGoogleIntegrationPublicView } from "../services/google-integration.server";
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
    return {
      onboarding: null,
      showOnboarding: false,
      syncStatus: null,
      metrics: null,
      healthScore: null,
      executiveBrief: null,
      insights: null,
      recommendations: null,
      currency: "USD",
    };
  }

  const store = await prisma.store.findUnique({
    where: { shopifyDomain: shop },
    select: { id: true, currency: true },
  });

  if (!store) {
    return {
      onboarding: null,
      showOnboarding: false,
      syncStatus: null,
      metrics: null,
      healthScore: null,
      executiveBrief: null,
      insights: null,
      recommendations: null,
      currency: "USD",
    };
  }

  const [onboarding, syncStatus, metrics] = await Promise.all([
    getOnboardingStatus(store.id),
    getStoreSyncStatus(store.id),
    getStoreMetrics(store.id),
  ]);

  const healthScore = calculateStoreHealthScore(metrics);

  const serializedOnboarding = serializeOnboardingForLoader(onboarding);

  return {
    onboarding: serializedOnboarding,
    showOnboarding: shouldShowOnboardingCardFromLoader(serializedOnboarding),
    syncStatus: serializeStoreSyncStatusForLoader(syncStatus),
    metrics: serializeMetricsForLoader(metrics),
    healthScore: serializeHealthScoreForLoader(healthScore),
    executiveBrief: serializeExecutiveBriefForLoader(
      calculateExecutiveBrief({
        metrics,
        healthScore,
        syncStatus,
        currency: store.currency,
      }),
    ),
    insights: serializeInsightsForLoader(
      buildStoreInsights({
        metrics,
        onboarding,
        healthScore,
      }),
    ),
    recommendations: serializeRecommendationsForLoader(
      buildStoreRecommendations({
        metrics,
        onboarding,
        healthScore,
      }),
    ),
    currency: store.currency,
  };
};

export default function Index() {
  const {
    onboarding,
    showOnboarding,
    syncStatus,
    metrics,
    healthScore,
    executiveBrief,
    insights,
    recommendations,
    currency,
  } = useLoaderData<typeof loader>();

  return (
    <s-page heading="StorePilot">
      {showOnboarding && onboarding ? <OnboardingCard onboarding={onboarding} /> : null}

      {syncStatus ? (
        <SyncStatusCard
          syncStatus={syncStatus}
          phaseStatuses={
            onboarding
              ? {
                  products: onboarding.productSyncStatus,
                  inventory: onboarding.inventorySyncStatus,
                  orders: onboarding.ordersSyncStatus,
                }
              : undefined
          }
        />
      ) : null}

      {metrics ? <MetricsOverviewCard metrics={metrics} currency={currency} /> : null}

      {healthScore ? <HealthScoreCard healthScore={healthScore} /> : null}

      {executiveBrief ? <ExecutiveBriefCard brief={executiveBrief} /> : null}

      {insights ? <InsightsCard insights={insights} /> : null}

      {recommendations ? <RecommendationsCard recommendations={recommendations} /> : null}

      <s-section heading="AI COO Status">
        <s-query-container>
          <s-grid
            gridTemplateColumns="@container (inline-size > 900px) repeat(5, 1fr), @container (inline-size > 500px) repeat(2, 1fr), 1fr"
            gap="base"
          >
            <s-grid-item>
              <s-box
                padding="base"
                background="base"
                borderWidth="small"
                borderColor="base"
                borderRadius="base"
              >
                <s-stack gap="small-200">
                  <s-text color="subdued">Store Health Score</s-text>
                  <s-heading>{showOnboarding ? "—" : "N/A"}</s-heading>
                </s-stack>
              </s-box>
            </s-grid-item>

            <s-grid-item>
              <s-box
                padding="base"
                background="base"
                borderWidth="small"
                borderColor="base"
                borderRadius="base"
              >
                <s-stack gap="small-200">
                  <s-text color="subdued">Revenue At Risk</s-text>
                  <s-heading>{showOnboarding ? "—" : "N/A"}</s-heading>
                </s-stack>
              </s-box>
            </s-grid-item>

            <s-grid-item>
              <s-box
                padding="base"
                background="base"
                borderWidth="small"
                borderColor="base"
                borderRadius="base"
              >
                <s-stack gap="small-200">
                  <s-text color="subdued">Revenue Opportunity</s-text>
                  <s-heading>{showOnboarding ? "—" : "N/A"}</s-heading>
                </s-stack>
              </s-box>
            </s-grid-item>

            <s-grid-item>
              <s-box
                padding="base"
                background="base"
                borderWidth="small"
                borderColor="base"
                borderRadius="base"
              >
                <s-stack gap="small-200">
                  <s-text color="subdued">Critical Issues</s-text>
                  <s-stack direction="inline" gap="small-200" alignItems="center">
                    <s-heading>0</s-heading>
                    <s-badge tone="critical">Critical</s-badge>
                  </s-stack>
                </s-stack>
              </s-box>
            </s-grid-item>

            <s-grid-item>
              <s-box
                padding="base"
                background="base"
                borderWidth="small"
                borderColor="base"
                borderRadius="base"
              >
                <s-stack gap="small-200">
                  <s-text color="subdued">Warning Issues</s-text>
                  <s-stack direction="inline" gap="small-200" alignItems="center">
                    <s-heading>0</s-heading>
                    <s-badge tone="warning">Warning</s-badge>
                  </s-stack>
                </s-stack>
              </s-box>
            </s-grid-item>
          </s-grid>
        </s-query-container>
      </s-section>

      <s-section heading="Today's Executive Brief">
        <s-box
          padding="base"
          background="subdued"
          borderWidth="small"
          borderColor="base"
          borderRadius="base"
        >
          <s-stack gap="base">
            <s-stack direction="inline" gap="small-200" alignItems="center">
              <s-badge>Executive Brief</s-badge>
              <s-text color="subdued">Daily summary</s-text>
            </s-stack>
            <s-paragraph>
              {showOnboarding
                ? "Your executive brief will appear here after StorePilot finishes syncing your store."
                : "Your executive brief will appear here after StorePilot completes its first analysis cycle."}
            </s-paragraph>
            <s-paragraph color="subdued">
              This section will surface key performance highlights, operational
              risks, and recommended focus areas for the day.
            </s-paragraph>
          </s-stack>
        </s-box>
      </s-section>

      <s-section heading="Priority Issues">
        <s-box
          padding="base"
          background="base"
          borderWidth="small"
          borderColor="base"
          borderRadius="base"
        >
          <s-stack gap="base">
            <s-stack direction="inline" justifyContent="space-between" alignItems="center">
              <s-text type="strong">Active priority issues</s-text>
              <s-link href="/app/issues">View all issues</s-link>
            </s-stack>
            <s-box padding="large-100" background="subdued" borderRadius="base">
              <s-stack gap="small-200">
                <s-text type="strong">No priority issues</s-text>
                <s-paragraph color="subdued">
                  {showOnboarding
                    ? "Issue detection starts after your initial store sync completes."
                    : "Critical and high-priority store issues will be listed here when detected."}
                </s-paragraph>
              </s-stack>
            </s-box>
          </s-stack>
        </s-box>
      </s-section>

      <s-section heading="Revenue Opportunities">
        <s-box
          padding="base"
          background="base"
          borderWidth="small"
          borderColor="base"
          borderRadius="base"
        >
          <s-stack gap="base">
            <s-stack direction="inline" justifyContent="space-between" alignItems="center">
              <s-text type="strong">Identified opportunities</s-text>
              <s-link href="/app/recommendations">View recommendations</s-link>
            </s-stack>
            <s-box padding="large-100" background="subdued" borderRadius="base">
              <s-stack gap="small-200">
                <s-text type="strong">No opportunities yet</s-text>
                <s-paragraph color="subdued">
                  {showOnboarding
                    ? "Recommendations will appear here after StorePilot finishes syncing your store."
                    : "Revenue opportunities will appear here after StorePilot analyzes your store data."}
                </s-paragraph>
              </s-stack>
            </s-box>
          </s-stack>
        </s-box>
      </s-section>

      <s-section slot="aside" heading="Platform Status">
        <s-stack gap="base">
          <s-stack direction="inline" justifyContent="space-between" alignItems="center">
            <s-text>StorePilot</s-text>
            <s-badge tone="success">Online</s-badge>
          </s-stack>
          <s-paragraph color="subdued">
            Operational intelligence platform
          </s-paragraph>
        </s-stack>
      </s-section>

      <s-section slot="aside" heading="Shopify Connected">
        <s-stack gap="base">
          <s-stack direction="inline" justifyContent="space-between" alignItems="center">
            <s-text>Store connection</s-text>
            <s-badge tone="success">Connected</s-badge>
          </s-stack>
          <s-paragraph color="subdued">
            Your Shopify store is linked and ready for analysis.
          </s-paragraph>
        </s-stack>
      </s-section>

      {showOnboarding && onboarding ? (
        <s-section slot="aside" heading="Setup Status">
          <s-stack gap="base">
            <s-badge tone="info">In progress</s-badge>
            <s-paragraph color="subdued">
              {onboarding.progressLabel ?? "Store setup is running in the background."}
            </s-paragraph>
            <s-text color="subdued">{onboarding.progressPercent}% complete</s-text>
          </s-stack>
        </s-section>
      ) : (
        <s-section slot="aside" heading="Dashboard">
          <s-stack gap="base">
            <s-badge tone="success">Ready</s-badge>
            <s-paragraph color="subdued">
              Your dashboard is ready. Metrics and briefings will populate as
              StorePilot analyzes your store.
            </s-paragraph>
          </s-stack>
        </s-section>
      )}

    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
