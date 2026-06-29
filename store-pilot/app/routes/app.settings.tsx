import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { redirect, useLoaderData } from "react-router";

import { OnboardingReminderBanner } from "../components/onboarding/OnboardingReminderBanner";
import prisma from "../db.server";
import {
  beginGoogleOAuth,
  disconnectGoogleIntegration,
  getGoogleIntegrationPublicView,
  listSelectableGoogleAnalyticsProperties,
  listSelectableSearchConsoleSites,
  saveGoogleAnalyticsProperty,
  saveGoogleSearchConsoleProperty,
  skipGoogleAnalyticsOnboarding,
  syncGoogleAnalyticsForStore,
  syncGoogleSearchConsoleForStore,
  syncGooglePageSpeedForStore,
} from "../services/google-integration.server";
import {
  connectMicrosoftClarityIntegration,
  disconnectMicrosoftClarityIntegration,
  getClarityIntegrationPublicView,
  syncMicrosoftClarityForStore,
} from "../services/clarity-integration.server";
import {
  getBillingDashboard,
  serializeBillingDashboardForRoute,
} from "../billing/billing-service";
import { getProductionHealthBadge } from "../production/production-service";
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
      googleIntegration: null,
      clarityIntegration: null,
      selectableProperties: [],
      selectableSearchConsoleSites: [],
      googleSetup: null,
      googleError: null,
      claritySetup: null,
      productionHealthBadge: { label: "Healthy", tone: "success" as const },
      onboardingReminders: [],
      billingSummary: null,
    };
  }

  const store = await prisma.store.findUnique({
    where: { shopifyDomain: shop },
    select: { id: true },
  });

  if (!store) {
    return {
      googleIntegration: null,
      clarityIntegration: null,
      selectableProperties: [],
      selectableSearchConsoleSites: [],
      googleSetup: null,
      googleError: null,
      claritySetup: null,
      productionHealthBadge: { label: "Healthy", tone: "success" as const },
    };
  }

  const url = new URL(request.url);
  const googleSetup = url.searchParams.get("googleSetup");
  const googleError = url.searchParams.get("googleError");
  const claritySetup = url.searchParams.get("claritySetup");
  const [googleIntegration, clarityIntegration, productionHealthBadge, onboardingReminders, billingSummary] =
    await Promise.all([
      getGoogleIntegrationPublicView(store.id),
      getClarityIntegrationPublicView(store.id),
      getProductionHealthBadge(store.id),
      getOnboardingReminders(store.id),
      getBillingDashboard(store.id).then(serializeBillingDashboardForRoute),
    ]);
  const selectableProperties =
    googleSetup === "select-property" && googleIntegration.needsPropertySelection
      ? await listSelectableGoogleAnalyticsProperties(store.id)
      : [];

  const selectableSearchConsoleSites =
    googleIntegration.connected &&
    (googleSetup === "select-search-console" || googleIntegration.needsSearchConsolePropertySelection) &&
    !googleIntegration.searchConsoleSiteUrl
      ? await listSelectableSearchConsoleSites(store.id)
      : [];

  return {
    googleIntegration,
    clarityIntegration,
    selectableProperties,
    selectableSearchConsoleSites,
    googleSetup,
    googleError,
    claritySetup,
    productionHealthBadge,
    onboardingReminders: serializeMerchantOnboardingRemindersForLoader(onboardingReminders),
    billingSummary,
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

  switch (intent) {
    case "connect-google": {
      const authorizationUrl = await beginGoogleOAuth({
        storeId: store.id,
        shop,
      });
      return redirect(authorizationUrl);
    }
    case "select-google-property": {
      const propertyId = String(formData.get("propertyId") ?? "");
      const propertyName = String(formData.get("propertyName") ?? propertyId);
      const view = await saveGoogleAnalyticsProperty({
        storeId: store.id,
        propertyId,
        propertyName,
      });
      if (view.needsSearchConsolePropertySelection) {
        return redirect("/app/settings?googleSetup=select-search-console");
      }
      return redirect("/app/settings");
    }
    case "select-search-console-property": {
      const siteUrl = String(formData.get("siteUrl") ?? "");
      const siteName = String(formData.get("siteName") ?? siteUrl);
      await saveGoogleSearchConsoleProperty({
        storeId: store.id,
        siteUrl,
        siteName,
      });
      return redirect("/app/settings");
    }
    case "disconnect-google": {
      await disconnectGoogleIntegration(store.id);
      return redirect("/app/settings");
    }
    case "sync-google-analytics": {
      await syncGoogleAnalyticsForStore(store.id);
      return redirect("/app/settings");
    }
    case "sync-google-search-console": {
      await syncGoogleSearchConsoleForStore(store.id);
      return redirect("/app/settings");
    }
    case "sync-google-pagespeed": {
      await syncGooglePageSpeedForStore(store.id);
      return redirect("/app/settings");
    }
    case "connect-clarity": {
      const projectId = String(formData.get("projectId") ?? "");
      const projectName = String(formData.get("projectName") ?? projectId);
      const apiToken = String(formData.get("apiToken") ?? "");
      await connectMicrosoftClarityIntegration({
        storeId: store.id,
        projectId,
        projectName,
        apiToken,
      });
      return redirect("/app/settings");
    }
    case "sync-clarity": {
      await syncMicrosoftClarityForStore(store.id);
      return redirect("/app/settings");
    }
    case "disconnect-clarity": {
      await disconnectMicrosoftClarityIntegration(store.id);
      return redirect("/app/settings");
    }
    case "skip-google-analytics": {
      await skipGoogleAnalyticsOnboarding(store.id);
      return redirect("/app");
    }
    default:
      return Response.json({ ok: false, error: "unsupported_intent" }, { status: 400 });
  }
};

export default function SettingsPage() {
  const {
    googleIntegration,
    clarityIntegration,
    selectableProperties,
    selectableSearchConsoleSites,
    googleSetup,
    googleError,
    claritySetup,
    productionHealthBadge,
    onboardingReminders,
    billingSummary,
  } = useLoaderData<typeof loader>();

  return (
    <s-page heading="Settings">
      <OnboardingReminderBanner reminders={onboardingReminders ?? []} heading="Integration reminders" />
      <s-section heading="Production Health">
        <s-box padding="base" background="subdued" borderRadius="base">
          <s-stack direction="inline" gap="base" alignItems="center">
            <s-text type="strong">Integration health</s-text>
            <s-badge tone={productionHealthBadge.tone}>{productionHealthBadge.label}</s-badge>
            <s-link href="/app/system-health">Open System Health</s-link>
          </s-stack>
        </s-box>
      </s-section>
      <s-section heading="Briefing Preferences">
        <s-box
          padding="base"
          background="base"
          borderWidth="small"
          borderColor="base"
          borderRadius="base"
        >
          <s-stack gap="base">
            <s-stack direction="inline" justifyContent="space-between" alignItems="center">
              <s-text type="strong">Daily COO briefing schedule</s-text>
              <s-badge>Daily</s-badge>
            </s-stack>
            <s-text-field label="Briefing delivery time" value="Not configured" disabled />
            <s-text-field label="Timezone" value="Not configured" disabled />
          </s-stack>
        </s-box>
      </s-section>

      <s-section heading="Integrations">
        <s-box
          padding="base"
          background="base"
          borderWidth="small"
          borderColor="base"
          borderRadius="base"
        >
          <s-stack gap="base">
            <s-text type="strong">Connected services</s-text>

            <s-box padding="large-100" background="subdued" borderRadius="base">
              <s-stack gap="base">
                <s-stack direction="inline" justifyContent="space-between" alignItems="center">
                  <s-text type="strong">Shopify</s-text>
                  <s-badge tone="success">Connected</s-badge>
                </s-stack>
                <s-paragraph color="subdued">
                  Your Shopify store is linked and ready for analysis.
                </s-paragraph>
              </s-stack>
            </s-box>

            <s-box padding="large-100" background="subdued" borderRadius="base">
              <s-stack gap="base">
                <s-stack direction="inline" justifyContent="space-between" alignItems="center">
                  <s-text type="strong">Google Analytics</s-text>
                  {googleIntegration?.connected ? (
                    <s-badge tone="success">Connected</s-badge>
                  ) : googleIntegration?.googleAnalyticsSkipped ? (
                    <s-badge tone="warning">Skipped</s-badge>
                  ) : (
                    <s-badge tone="warning">Not connected</s-badge>
                  )}
                </s-stack>

                {googleError ? (
                  <s-paragraph color="subdued">Google connection error: {googleError}</s-paragraph>
                ) : null}

                {googleIntegration?.connected ? (
                  <s-stack gap="small-200">
                    <s-paragraph color="subdued">
                      Property: {googleIntegration.analyticsPropertyName ?? "Not selected"}
                    </s-paragraph>
                    <s-paragraph color="subdued">
                      Account: {googleIntegration.email ?? "Unknown"}
                    </s-paragraph>
                    <s-paragraph color="subdued">
                      Last sync: {googleIntegration.lastSyncAt ?? "Never"}
                    </s-paragraph>
                    <s-stack direction="inline" gap="base">
                      <form method="post">
                        <input type="hidden" name="intent" value="sync-google-analytics" />
                        <s-button type="submit">Sync now</s-button>
                      </form>
                      <form method="post">
                        <input type="hidden" name="intent" value="connect-google" />
                        <s-button type="submit">Reconnect</s-button>
                      </form>
                      <form method="post">
                        <input type="hidden" name="intent" value="disconnect-google" />
                        <s-button tone="critical" type="submit">
                          Disconnect
                        </s-button>
                      </form>
                    </s-stack>
                  </s-stack>
                ) : (
                  <s-stack gap="base">
                    <s-paragraph color="subdued">
                      Optional. Unlocks traffic and revenue intelligence from GA4.
                    </s-paragraph>
                    <form method="post">
                      <input type="hidden" name="intent" value="connect-google" />
                      <s-button disabled={!googleIntegration?.configured} type="submit">
                        Connect Google
                      </s-button>
                    </form>
                  </s-stack>
                )}

                {googleSetup === "select-property" && selectableProperties.length > 0 ? (
                  <s-stack gap="base">
                    <s-text type="strong">Select a GA4 property</s-text>
                    {selectableProperties.map((property) => (
                      <form method="post" key={property.propertyId}>
                        <input type="hidden" name="intent" value="select-google-property" />
                        <input type="hidden" name="propertyId" value={property.propertyId} />
                        <input type="hidden" name="propertyName" value={property.displayName} />
                        <s-button type="submit">{property.displayName}</s-button>
                      </form>
                    ))}
                  </s-stack>
                ) : null}
              </s-stack>
            </s-box>

            <s-box padding="large-100" background="subdued" borderRadius="base">
              <s-stack gap="base">
                <s-stack direction="inline" justifyContent="space-between" alignItems="center">
                  <s-text type="strong">Google Search Console</s-text>
                  {googleIntegration?.searchConsoleSiteUrl ? (
                    <s-badge tone="success">Connected</s-badge>
                  ) : googleIntegration?.connected ? (
                    <s-badge tone="warning">Property required</s-badge>
                  ) : (
                    <s-badge tone="warning">Not connected</s-badge>
                  )}
                </s-stack>

                {googleIntegration?.searchConsoleSiteUrl ? (
                  <s-stack gap="small-200">
                    <s-paragraph color="subdued">
                      Property: {googleIntegration.searchConsoleSiteName ?? googleIntegration.searchConsoleSiteUrl}
                    </s-paragraph>
                    <s-paragraph color="subdued">
                      Last sync: {googleIntegration.searchConsoleLastSyncAt ?? "Never"}
                    </s-paragraph>
                    <s-stack direction="inline" gap="base">
                      <form method="post">
                        <input type="hidden" name="intent" value="sync-google-search-console" />
                        <s-button type="submit">Sync now</s-button>
                      </form>
                      <form method="post">
                        <input type="hidden" name="intent" value="connect-google" />
                        <s-button type="submit">Reconnect</s-button>
                      </form>
                      <form method="post">
                        <input type="hidden" name="intent" value="disconnect-google" />
                        <s-button tone="critical" type="submit">
                          Disconnect
                        </s-button>
                      </form>
                    </s-stack>
                  </s-stack>
                ) : googleIntegration?.connected ? (
                  <s-paragraph color="subdued">
                    Select a Search Console property to unlock organic search visibility data.
                  </s-paragraph>
                ) : (
                  <s-paragraph color="subdued">
                    Connect Google first to configure Search Console.
                  </s-paragraph>
                )}

                {selectableSearchConsoleSites.length > 0 ? (
                  <s-stack gap="base">
                    <s-text type="strong">Select a Search Console property</s-text>
                    {selectableSearchConsoleSites.map((site) => (
                      <form method="post" key={site.siteUrl}>
                        <input type="hidden" name="intent" value="select-search-console-property" />
                        <input type="hidden" name="siteUrl" value={site.siteUrl} />
                        <input type="hidden" name="siteName" value={site.displayName} />
                        <s-button type="submit">{site.displayName}</s-button>
                      </form>
                    ))}
                  </s-stack>
                ) : null}
              </s-stack>
            </s-box>

            <s-box padding="large-100" background="subdued" borderRadius="base">
              <s-stack gap="base">
                <s-stack direction="inline" justifyContent="space-between" alignItems="center">
                  <s-text type="strong">Google PageSpeed Insights</s-text>
                  {googleIntegration?.pageSpeedAvailable ? (
                    <s-badge tone="success">Connected</s-badge>
                  ) : googleIntegration?.connected ? (
                    <s-badge tone="warning">Storefront URL required</s-badge>
                  ) : (
                    <s-badge tone="warning">Not connected</s-badge>
                  )}
                </s-stack>

                {googleIntegration?.pageSpeedAvailable ? (
                  <s-stack gap="small-200">
                    <s-paragraph color="subdued">
                      Last sync: {googleIntegration.pageSpeedLastSyncAt ?? "Never"}
                    </s-paragraph>
                    <s-stack direction="inline" gap="base">
                      <form method="post">
                        <input type="hidden" name="intent" value="sync-google-pagespeed" />
                        <s-button type="submit">Run test</s-button>
                      </form>
                      <form method="post">
                        <input type="hidden" name="intent" value="connect-google" />
                        <s-button type="submit">Reconnect</s-button>
                      </form>
                      <form method="post">
                        <input type="hidden" name="intent" value="disconnect-google" />
                        <s-button tone="critical" type="submit">
                          Disconnect
                        </s-button>
                      </form>
                    </s-stack>
                  </s-stack>
                ) : googleIntegration?.connected ? (
                  <s-paragraph color="subdued">
                    Connect Search Console or ensure your Shopify storefront domain is available to
                    run PageSpeed analysis.
                  </s-paragraph>
                ) : (
                  <s-paragraph color="subdued">
                    Connect Google first to enable PageSpeed Insights.
                  </s-paragraph>
                )}
              </s-stack>
            </s-box>

            <s-box padding="large-100" background="subdued" borderRadius="base">
              <s-stack gap="base">
                <s-stack direction="inline" justifyContent="space-between" alignItems="center">
                  <s-text type="strong">Microsoft Clarity</s-text>
                  {clarityIntegration?.connected ? (
                    <s-badge tone="success">Connected</s-badge>
                  ) : (
                    <s-badge tone="warning">Not connected</s-badge>
                  )}
                </s-stack>

                {clarityIntegration?.connected ? (
                  <s-stack gap="small-200">
                    <s-paragraph color="subdued">
                      Project: {clarityIntegration.projectName ?? clarityIntegration.projectId}
                    </s-paragraph>
                    <s-paragraph color="subdued">
                      Last sync: {clarityIntegration.lastSyncAt ?? "Never"}
                    </s-paragraph>
                    <s-stack direction="inline" gap="base">
                      <form method="post">
                        <input type="hidden" name="intent" value="sync-clarity" />
                        <s-button type="submit">Run sync</s-button>
                      </form>
                      <form method="post">
                        <input type="hidden" name="intent" value="disconnect-clarity" />
                        <s-button tone="critical" type="submit">
                          Disconnect
                        </s-button>
                      </form>
                    </s-stack>
                    <form method="post">
                      <input type="hidden" name="intent" value="connect-clarity" />
                      <s-text-field label="Project ID" name="projectId" value={clarityIntegration.projectId ?? ""} required />
                      <s-text-field label="Project name" name="projectName" value={clarityIntegration.projectName ?? ""} />
                      <s-text-field label="API token" name="apiToken" required />
                      <s-button type="submit">Reconnect</s-button>
                    </form>
                  </s-stack>
                ) : (
                  <s-stack gap="base">
                    <s-paragraph color="subdued">
                      Optional. Unlocks aggregated behavior and UX interaction metrics.
                    </s-paragraph>
                    {claritySetup === "connect" || !clarityIntegration?.connected ? (
                      <form method="post">
                        <input type="hidden" name="intent" value="connect-clarity" />
                        <s-text-field label="Project ID" name="projectId" required />
                        <s-text-field label="Project name" name="projectName" />
                        <s-text-field label="API token" name="apiToken" required />
                        <s-button type="submit">Connect Clarity</s-button>
                      </form>
                    ) : null}
                  </s-stack>
                )}
              </s-stack>
            </s-box>

            <s-box padding="large-100" background="subdued" borderRadius="base">
              <s-stack gap="base">
                <s-stack direction="inline" justifyContent="space-between" alignItems="center">
                  <s-text type="strong">Microsoft Clarity</s-text>
                  {clarityIntegration?.connected ? (
                    <s-badge tone="success">Connected</s-badge>
                  ) : (
                    <s-badge tone="warning">Not connected</s-badge>
                  )}
                </s-stack>

                {clarityIntegration?.connected ? (
                  <s-stack gap="small-200">
                    <s-paragraph color="subdued">
                      Project: {clarityIntegration.projectName ?? clarityIntegration.projectId}
                    </s-paragraph>
                    <s-paragraph color="subdued">
                      Last sync: {clarityIntegration.lastSyncAt ?? "Never"}
                    </s-paragraph>
                    <s-stack direction="inline" gap="base">
                      <form method="post">
                        <input type="hidden" name="intent" value="sync-clarity" />
                        <s-button type="submit">Run sync</s-button>
                      </form>
                      <form method="post">
                        <input type="hidden" name="intent" value="disconnect-clarity" />
                        <s-button tone="critical" type="submit">
                          Disconnect
                        </s-button>
                      </form>
                    </s-stack>
                    <form method="post">
                      <input type="hidden" name="intent" value="connect-clarity" />
                      <s-text-field label="Project ID" name="projectId" value={clarityIntegration.projectId ?? ""} required />
                      <s-text-field label="Project name" name="projectName" value={clarityIntegration.projectName ?? ""} />
                      <s-text-field label="API token" name="apiToken" required />
                      <s-button type="submit">Reconnect</s-button>
                    </form>
                  </s-stack>
                ) : (
                  <s-stack gap="base">
                    <s-paragraph color="subdued">
                      Optional. Unlocks aggregated behavior and UX interaction metrics.
                    </s-paragraph>
                    {claritySetup === "connect" || !clarityIntegration?.connected ? (
                      <form method="post">
                        <input type="hidden" name="intent" value="connect-clarity" />
                        <s-text-field label="Project ID" name="projectId" required />
                        <s-text-field label="Project name" name="projectName" />
                        <s-text-field label="API token" name="apiToken" required />
                        <s-button type="submit">Connect Clarity</s-button>
                      </form>
                    ) : null}
                  </s-stack>
                )}
              </s-stack>
            </s-box>
          </s-stack>
        </s-box>
      </s-section>

      <s-section heading="Notifications">
        <s-box padding="base" background="base" borderWidth="small" borderColor="base" borderRadius="base">
          <s-stack gap="base">
            <s-text type="strong">Critical alerts</s-text>
            <s-paragraph color="subdued">
              StorePilot sends alerts for high-impact issues only to avoid alert fatigue.
            </s-paragraph>
          </s-stack>
        </s-box>
      </s-section>

      <s-section heading="Billing">
        <s-box padding="base" background="subdued" borderRadius="base">
          <s-stack gap="base">
            {billingSummary ? (
              <>
                <s-stack direction="inline" justifyContent="space-between" alignItems="center">
                  <s-text type="strong">{billingSummary.currentPlan.name}</s-text>
                  <s-badge tone={billingSummary.commercialStatus === "active" ? "success" : "warning"}>
                    {billingSummary.commercialStatus}
                  </s-badge>
                </s-stack>
                <s-text>${billingSummary.currentPlan.monthlyPriceUsd}/month</s-text>
                {billingSummary.trial.active ? (
                  <s-text color="subdued">
                    Trial: {billingSummary.trial.remainingDays} day
                    {billingSummary.trial.remainingDays === 1 ? "" : "s"} remaining
                  </s-text>
                ) : null}
                <s-link href="/app/billing">Manage billing</s-link>
              </>
            ) : (
              <s-text color="subdued">Billing unavailable.</s-text>
            )}
          </s-stack>
        </s-box>
      </s-section>

      <s-section heading="Account & Plan">
        <s-box padding="base" background="base" borderWidth="small" borderColor="base" borderRadius="base">
          <s-stack gap="base">
            <s-paragraph color="subdued">
              Plan changes require explicit Shopify billing approval. No automatic charges are created.
            </s-paragraph>
            <s-link href="/app/billing">View plans and usage</s-link>
          </s-stack>
        </s-box>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
