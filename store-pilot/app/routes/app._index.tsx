import type { JobStatus } from "@prisma/client";
import type {
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useLoaderData } from "react-router";

import { ExecutiveBriefCard } from "../components/ExecutiveBriefCard";
import { HealthScoreCard } from "../components/HealthScoreCard";
import { InsightsCard } from "../components/InsightsCard";
import { QuickWinsCard } from "../components/QuickWinsCard";
import { LearningBootstrapCard } from "../components/LearningBootstrapCard";
import { MetricsOverviewCard } from "../components/MetricsOverviewCard";
import { RecommendationsCard } from "../components/RecommendationsCard";
import { SyncStatusCard } from "../components/SyncStatusCard";
import {
  PremiumHero,
  PremiumSection,
  PremiumAsideCard,
} from "../components/dashboard";
import {
  IconPulse,
  IconSync,
  IconHealth,
} from "../components/dashboard/DashboardIcons";
import styles from "../components/dashboard/premium-dashboard.module.css";
import { formatCurrency, formatMetricNumber } from "../lib/format";
import prisma from "../db.server";
import {
  calculateExecutiveBrief,
  serializeExecutiveBriefForLoader,
} from "../services/executive-brief.server";
import {
  calculateStoreHealthScore,
  serializeHealthScoreForLoader,
} from "../services/health-score.server";
import { getLearningBootstrapForUi } from "../services/learning-ui.server";
import { getQuickWinsForDashboard } from "../services/quick-wins-ui.server";
import { getExecutiveDashboardForUi } from "../services/executive-ui.server";
import { ExecutiveDashboardCards } from "../executive/ui";
import { RootCauseDashboardCards } from "../root-cause/ui";
import { getRootCauseDashboardForUi } from "../services/root-cause-ui.server";
import { PredictionDashboardCards } from "../prediction/ui";
import { getPredictionDashboardForUi } from "../services/prediction-ui.server";
import { ExperimentDashboardCards } from "../experiments/ui";
import { getExperimentDashboardForUi } from "../services/experiment-ui.server";
import { MerchantIntelligenceDashboard } from "../merchant-intelligence/ui";
import { getMerchantIntelligenceDashboardForUi } from "../services/merchant-intelligence-ui.server";
import { WorkspaceLaunchCard } from "../intelligence-ui";
import { WORKSPACE_ROUTES } from "../intelligence-ui/constants";
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
      learningBootstrap: null,
      quickWins: null,
      executiveDashboard: null,
      rootCause: null,
      prediction: null,
      experiments: null,
      merchantIntelligence: null,
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
      learningBootstrap: null,
      quickWins: null,
      executiveDashboard: null,
      rootCause: null,
      prediction: null,
      experiments: null,
      merchantIntelligence: null,
    };
  }

  const [onboarding, syncStatus, metrics] = await Promise.all([
    getOnboardingStatus(store.id),
    getStoreSyncStatus(store.id),
    getStoreMetrics(store.id),
  ]);

  const healthScore = calculateStoreHealthScore(metrics);

  const serializedOnboarding = serializeOnboardingForLoader(onboarding);
  const learningBootstrap = await getLearningBootstrapForUi(store.id, {
    products: serializedOnboarding?.productSyncStatus,
    inventory: serializedOnboarding?.inventorySyncStatus,
    orders: serializedOnboarding?.ordersSyncStatus,
  });
  const quickWins = await getQuickWinsForDashboard(store.id, store.currency);
  const executiveDashboard = await getExecutiveDashboardForUi(store.id, store.currency);
  const rootCause = await getRootCauseDashboardForUi(store.id);
  const prediction = await getPredictionDashboardForUi(store.id);
  const experiments = await getExperimentDashboardForUi(store.id);
  const merchantIntelligence = await getMerchantIntelligenceDashboardForUi(store.id);

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
    learningBootstrap,
    quickWins,
    executiveDashboard,
    rootCause,
    prediction,
    experiments,
    merchantIntelligence,
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
    learningBootstrap,
    quickWins,
    executiveDashboard,
    rootCause,
    prediction,
    experiments,
    merchantIntelligence,
  } = useLoaderData<typeof loader>();

  return (
    <s-page heading="StorePilot">
      <div className={styles.shell}>
        <PremiumHero
          healthScore={healthScore?.score ?? null}
          revenueLabel={
            metrics ? formatCurrency(metrics.grossRevenue, currency) : null
          }
          ordersLabel={metrics ? formatMetricNumber(metrics.orders) : null}
          showOnboarding={showOnboarding}
        />

        <PremiumSection
          title="Intelligence Workspaces"
          subtitle="Jump into specialized command centers for every domain"
          icon={<IconPulse size={20} />}
        >
          <div className={styles.workspaceGrid}>
            <WorkspaceLaunchCard
              title="Executive"
              description="Briefing, operating plan, decision queue, and readiness."
              href={WORKSPACE_ROUTES.executive}
            />
            <WorkspaceLaunchCard
              title="Inventory"
              description="Stock risks, root causes, predictions, and experiments."
              href={WORKSPACE_ROUTES.inventory}
            />
            <WorkspaceLaunchCard
              title="Pricing"
              description="Margin risks, elasticity signals, and pricing experiments."
              href={WORKSPACE_ROUTES.pricing}
            />
            <WorkspaceLaunchCard
              title="Knowledge Graph"
              description="Explore product, vendor, and revenue relationships."
              href={WORKSPACE_ROUTES.knowledgeGraph}
            />
            <WorkspaceLaunchCard
              title="Business Memory"
              description="Patterns, seasonality, DNA versions, and learning."
              href={WORKSPACE_ROUTES.businessMemory}
            />
            <WorkspaceLaunchCard
              title="Timeline"
              description="Unified chronological intelligence across your store."
              href={WORKSPACE_ROUTES.timeline}
            />
          </div>
        </PremiumSection>

        {showOnboarding && learningBootstrap ? (
          <LearningBootstrapCard learning={learningBootstrap} />
        ) : null}

        {quickWins ? <QuickWinsCard quickWins={quickWins} currency={currency} /> : null}

        {executiveDashboard ? (
          <ExecutiveDashboardCards executive={executiveDashboard} />
        ) : null}

        {rootCause ? (
          <RootCauseDashboardCards rootCause={rootCause} currency={currency} />
        ) : null}

        {prediction ? (
          <PredictionDashboardCards prediction={prediction} currency={currency} />
        ) : null}

        {experiments ? (
          <ExperimentDashboardCards experiments={experiments} currency={currency} />
        ) : null}

        {merchantIntelligence ? (
          <MerchantIntelligenceDashboard intelligence={merchantIntelligence} />
        ) : null}

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
            currentJobStatus={
              (onboarding?.currentJobStatus as JobStatus | null | undefined) ??
              null
            }
            setupProgressPercent={onboarding?.progressPercent}
          />
        ) : null}

        {metrics ? <MetricsOverviewCard metrics={metrics} currency={currency} /> : null}

        {healthScore ? <HealthScoreCard healthScore={healthScore} /> : null}

        {executiveBrief ? <ExecutiveBriefCard brief={executiveBrief} /> : null}

        {insights ? <InsightsCard insights={insights} /> : null}

        {recommendations ? <RecommendationsCard recommendations={recommendations} /> : null}
      </div>

      <s-section slot="aside">
        <div className={styles.asideStack}>
          <PremiumAsideCard
            title="Platform Status"
            icon={<IconPulse size={18} />}
            badge={<s-badge tone="success">Online</s-badge>}
          >
            <p className={styles.sectionSubtitle}>
              Operational intelligence platform — all systems operational.
            </p>
          </PremiumAsideCard>

          <PremiumAsideCard
            title="Shopify Connected"
            icon={<IconSync size={18} />}
            badge={<s-badge tone="success">Connected</s-badge>}
          >
            <p className={styles.sectionSubtitle}>
              Your Shopify store is linked and ready for analysis.
            </p>
          </PremiumAsideCard>

          {showOnboarding && onboarding ? (
            <PremiumAsideCard
              title="Setup Status"
              icon={<IconHealth size={18} />}
              badge={<s-badge tone="info">In progress</s-badge>}
            >
              <p className={styles.sectionSubtitle}>
                {onboarding.progressLabel ?? "Store setup is running in the background."}
              </p>
              <div className={styles.progressTrack} style={{ marginTop: 12 }}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${onboarding.progressPercent ?? 0}%` }}
                />
              </div>
              <p className={styles.metricTrend} style={{ marginTop: 8 }}>
                {onboarding.progressPercent}% complete
              </p>
            </PremiumAsideCard>
          ) : (
            <PremiumAsideCard
              title="Dashboard"
              icon={<IconHealth size={18} />}
              badge={<s-badge tone="success">Ready</s-badge>}
            >
              <p className={styles.sectionSubtitle}>
                Your dashboard is live. Metrics and briefings populate as StorePilot
                analyzes your store.
              </p>
            </PremiumAsideCard>
          )}
        </div>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
