import type { JobStatus } from "@prisma/client";
import { Suspense, lazy, useEffect, useRef } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import {
  Await,
  useLoaderData,
  useRevalidator,
} from "react-router";

import { ExecutiveBriefCard } from "../components/ExecutiveBriefCard";
import { HealthScoreCard } from "../components/HealthScoreCard";
import { InsightsCard } from "../components/InsightsCard";
import { MetricsOverviewCard } from "../components/MetricsOverviewCard";
import { RecommendationsCard } from "../components/RecommendationsCard";
import { SyncStatusCard } from "../components/SyncStatusCard";
import {
  PremiumHero,
  PremiumSection,
  PremiumAsideCard,
} from "../components/dashboard";
import { DeferredSectionSkeleton } from "../components/dashboard/DeferredSectionSkeleton";
import {
  IconPulse,
  IconSync,
  IconHealth,
} from "../components/dashboard/DashboardIcons";
import styles from "../components/dashboard/premium-dashboard.module.css";
import { formatCurrency, formatMetricNumber } from "../lib/format";
import { isReactRouterDataRequest } from "../lib/react-router-request.server";
import {
  deferIntelligenceSection,
  getRequestLogContext,
  logRouteLoader,
  timeLoaderSection,
} from "../lib/route-loader-log.server";
import { resolveRequestStoreContext } from "../lib/request-auth.server";
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
import { getRootCauseDashboardForUi } from "../services/root-cause-ui.server";
import { getPredictionDashboardForUi } from "../services/prediction-ui.server";
import { getExperimentDashboardForUi } from "../services/experiment-ui.server";
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
import { boundary } from "@shopify/shopify-app-react-router/server";

const LearningBootstrapCard = lazy(
  () =>
    import("../components/LearningBootstrapCard").then((module) => ({
      default: module.LearningBootstrapCard,
    })),
);
const QuickWinsCard = lazy(() =>
  import("../components/QuickWinsCard").then((module) => ({
    default: module.QuickWinsCard,
  })),
);
const ExecutiveDashboardCards = lazy(() =>
  import("../executive/ui").then((module) => ({
    default: module.ExecutiveDashboardCards,
  })),
);
const RootCauseDashboardCards = lazy(() =>
  import("../root-cause/ui").then((module) => ({
    default: module.RootCauseDashboardCards,
  })),
);
const PredictionDashboardCards = lazy(() =>
  import("../prediction/ui").then((module) => ({
    default: module.PredictionDashboardCards,
  })),
);
const ExperimentDashboardCards = lazy(() =>
  import("../experiments/ui").then((module) => ({
    default: module.ExperimentDashboardCards,
  })),
);
const MerchantIntelligenceDashboard = lazy(() =>
  import("../merchant-intelligence/ui").then((module) => ({
    default: module.MerchantIntelligenceDashboard,
  })),
);

const EMPTY_SHELL = {
  onboarding: null,
  showOnboarding: false,
  syncStatus: null,
  metrics: null,
  healthScore: null,
  executiveBrief: null,
  insights: null,
  recommendations: null,
  currency: "USD",
  deferIntelligenceLoad: false,
  learningBootstrap: null,
  quickWins: null,
  executiveDashboard: null,
  rootCause: null,
  prediction: null,
  experiments: null,
  merchantIntelligence: null,
};

const EMPTY_INTELLIGENCE = {
  learningBootstrap: null,
  quickWins: null,
  executiveDashboard: null,
  rootCause: null,
  prediction: null,
  experiments: null,
  merchantIntelligence: null,
} as const;

function loadIntelligenceSections(
  storeId: string,
  currency: string,
  logContext: {
    shop: string | null;
    route: string;
    requestId: string | null;
  },
  onboardingPhase?: {
    products?: string;
    inventory?: string;
    orders?: string;
  },
) {
  const ctx = { ...logContext, storeId };
  return {
    learningBootstrap: deferIntelligenceSection(
      "getLearningBootstrapForUi",
      ctx,
      () => getLearningBootstrapForUi(storeId, onboardingPhase),
    ),
    quickWins: deferIntelligenceSection("getQuickWinsForDashboard", ctx, () =>
      getQuickWinsForDashboard(storeId, currency),
    ),
    executiveDashboard: deferIntelligenceSection(
      "getExecutiveDashboardForUi",
      ctx,
      () => getExecutiveDashboardForUi(storeId, currency),
    ),
    rootCause: deferIntelligenceSection("getRootCauseDashboardForUi", ctx, () =>
      getRootCauseDashboardForUi(storeId),
    ),
    prediction: deferIntelligenceSection("getPredictionDashboardForUi", ctx, () =>
      getPredictionDashboardForUi(storeId),
    ),
    experiments: deferIntelligenceSection("getExperimentDashboardForUi", ctx, () =>
      getExperimentDashboardForUi(storeId),
    ),
    merchantIntelligence: deferIntelligenceSection(
      "getMerchantIntelligenceDashboardForUi",
      ctx,
      () => getMerchantIntelligenceDashboardForUi(storeId),
    ),
  };
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { route, requestId } = getRequestLogContext(request);

  try {
    const logContext = { route, requestId, shop: null as string | null, storeId: undefined as string | undefined };

    const storeContext = await timeLoaderSection("authenticateAndResolveStore", logContext, () =>
      resolveRequestStoreContext(request),
    );

    if (!storeContext) {
      return EMPTY_SHELL;
    }

    const { shop, storeId, currency } = storeContext;
    logContext.shop = shop;
    logContext.storeId = storeId;

    const [onboarding, syncStatus, metrics] = await timeLoaderSection(
      "dashboardShellParallel",
      logContext,
      () =>
        Promise.all([
          getOnboardingStatus(storeId),
          getStoreSyncStatus(storeId),
          getStoreMetrics(storeId, { nonBlocking: true }),
        ]),
    );

    const healthScore = calculateStoreHealthScore(metrics);
    const serializedOnboarding = serializeOnboardingForLoader(onboarding);
    const loadIntelligence = isReactRouterDataRequest(request);
    const onboardingPhase = {
      products: serializedOnboarding?.productSyncStatus,
      inventory: serializedOnboarding?.inventorySyncStatus,
      orders: serializedOnboarding?.ordersSyncStatus,
    };

    logRouteLoader("info", "Dashboard loader completed shell", {
      route,
      function: "loader",
      shop,
      storeId: storeId,
      requestId,
      operation: loadIntelligence
        ? "dashboard_data_with_intelligence"
        : "dashboard_document_shell",
    });

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
          currency,
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
      currency,
      deferIntelligenceLoad: !loadIntelligence,
      ...(loadIntelligence
        ? loadIntelligenceSections(storeId, currency, {
            shop,
            route,
            requestId,
          }, onboardingPhase)
        : EMPTY_INTELLIGENCE),
    };
  } catch (error) {
    logRouteLoader("error", "Dashboard loader failed", {
      route,
      function: "loader",
      requestId,
      operation: "dashboard_loader_failed",
      reason: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return EMPTY_SHELL;
  }
};

export default function Index() {
  const data = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  const intelligenceRevalidatedRef = useRef(false);
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
    deferIntelligenceLoad,
    learningBootstrap,
    quickWins,
    executiveDashboard,
    rootCause,
    prediction,
    experiments,
    merchantIntelligence,
  } = data;

  const { revalidate, state: revalidatorState } = revalidator;

  useEffect(() => {
    if (
      !deferIntelligenceLoad ||
      intelligenceRevalidatedRef.current ||
      revalidatorState !== "idle"
    ) {
      return;
    }

    intelligenceRevalidatedRef.current = true;
    revalidate();
  }, [deferIntelligenceLoad, revalidatorState, revalidate]);

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

        {showOnboarding ? (
          <Suspense
            fallback={
              <DeferredSectionSkeleton title="Loading setup progress…" />
            }
          >
            <Await resolve={learningBootstrap}>
              {(learning) =>
                learning ? <LearningBootstrapCard learning={learning} /> : null
              }
            </Await>
          </Suspense>
        ) : null}

        <Suspense
          fallback={<DeferredSectionSkeleton title="Loading quick wins…" />}
        >
          <Await resolve={quickWins}>
            {(wins) =>
              wins ? <QuickWinsCard quickWins={wins} currency={currency} /> : null
            }
          </Await>
        </Suspense>

        <Suspense
          fallback={
            <DeferredSectionSkeleton title="Loading executive intelligence…" />
          }
        >
          <Await resolve={executiveDashboard}>
            {(executive) =>
              executive ? (
                <ExecutiveDashboardCards executive={executive} />
              ) : null
            }
          </Await>
        </Suspense>

        <Suspense
          fallback={
            <DeferredSectionSkeleton title="Loading root cause analysis…" />
          }
        >
          <Await resolve={rootCause}>
            {(causes) =>
              causes ? (
                <RootCauseDashboardCards rootCause={causes} currency={currency} />
              ) : null
            }
          </Await>
        </Suspense>

        <Suspense
          fallback={<DeferredSectionSkeleton title="Loading predictions…" />}
        >
          <Await resolve={prediction}>
            {(predictions) =>
              predictions ? (
                <PredictionDashboardCards
                  prediction={predictions}
                  currency={currency}
                />
              ) : null
            }
          </Await>
        </Suspense>

        <Suspense
          fallback={<DeferredSectionSkeleton title="Loading experiments…" />}
        >
          <Await resolve={experiments}>
            {(experimentData) =>
              experimentData ? (
                <ExperimentDashboardCards
                  experiments={experimentData}
                  currency={currency}
                />
              ) : null
            }
          </Await>
        </Suspense>

        <Suspense
          fallback={
            <DeferredSectionSkeleton title="Loading merchant intelligence…" />
          }
        >
          <Await resolve={merchantIntelligence}>
            {(intelligence) =>
              intelligence ? (
                <MerchantIntelligenceDashboard intelligence={intelligence} />
              ) : null
            }
          </Await>
        </Suspense>

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

        {recommendations ? (
          <RecommendationsCard recommendations={recommendations} />
        ) : null}
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
                {onboarding.progressLabel ??
                  "Store setup is running in the background."}
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
                Your dashboard is live. Metrics and briefings populate as
                StorePilot analyzes your store.
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
