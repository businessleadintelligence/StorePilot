import { randomUUID } from "node:crypto";

import type { GoogleIntegration } from "@prisma/client";

import prisma from "../db.server";
import { fetchGa4AnalyticsReport } from "../google/analytics/ga4-client";
import { parseGa4Report } from "../google/analytics/ga4-parser";
import {
  buildGoogleOAuthAuthorizationUrl,
  exchangeGoogleOAuthCode,
  fetchGoogleUserInfo,
  isGoogleOAuthConfigured,
  listGoogleAnalyticsProperties,
  parseGoogleOAuthState,
  type GoogleAnalyticsPropertySummary,
} from "../google/oauth/google-oauth.service";
import {
  getValidGoogleAccessToken,
  logGoogleIntegrationError,
  logGoogleIntegrationEvent,
  persistGoogleTokens,
} from "../google/oauth/google-token.service";
import { GoogleApiError } from "../google/shared/google-api-error";
import {
  bootstrapConnectorPlatform,
  syncStoreConnectors,
} from "../connectors";
import { listGscSites } from "../google/search-console/gsc-client";
import { resolvePageSpeedStoreUrl } from "../google/pagespeed/pagespeed-query-builder";
import {
  decryptSecretToken,
  encryptSecretToken,
} from "./token-crypto.server";

export type GoogleIntegrationPublicView = {
  connected: boolean;
  configured: boolean;
  email: string | null;
  analyticsPropertyId: string | null;
  analyticsPropertyName: string | null;
  searchConsoleSiteUrl: string | null;
  searchConsoleSiteName: string | null;
  connectedAt: string | null;
  lastSyncAt: string | null;
  searchConsoleLastSyncAt: string | null;
  pageSpeedLastSyncAt: string | null;
  pageSpeedAvailable: boolean;
  isActive: boolean;
  needsPropertySelection: boolean;
  needsSearchConsolePropertySelection: boolean;
  googleAnalyticsSkipped: boolean;
};

export type GooglePropertySelectionView = {
  properties: GoogleAnalyticsPropertySummary[];
};

export async function getGoogleIntegrationPublicView(
  storeId: string,
): Promise<GoogleIntegrationPublicView> {
  const [integration, onboarding, store] = await Promise.all([
    prisma.googleIntegration.findUnique({ where: { storeId } }),
    prisma.storeOnboarding.findUnique({
      where: { storeId },
      select: { googleAnalyticsSkippedAt: true },
    }),
    prisma.store.findUnique({
      where: { id: storeId },
      select: { shopifyDomain: true },
    }),
  ]);

  return serializeGoogleIntegrationPublicView(
    integration,
    onboarding?.googleAnalyticsSkippedAt ?? null,
    store?.shopifyDomain ?? null,
  );
}

export function serializeGoogleIntegrationPublicView(
  integration: GoogleIntegration | null,
  googleAnalyticsSkippedAt: Date | null,
  shopifyDomain: string | null = null,
): GoogleIntegrationPublicView {
  return {
    connected: Boolean(integration?.isActive && integration.refreshToken),
    configured: isGoogleOAuthConfigured(),
    email: integration?.email ?? null,
    analyticsPropertyId: integration?.analyticsPropertyId ?? null,
    analyticsPropertyName: integration?.analyticsPropertyName ?? null,
    searchConsoleSiteUrl: integration?.searchConsoleSiteUrl ?? null,
    searchConsoleSiteName: integration?.searchConsoleSiteName ?? null,
    connectedAt: integration?.connectedAt?.toISOString() ?? null,
    lastSyncAt: integration?.lastSyncAt?.toISOString() ?? null,
    searchConsoleLastSyncAt: integration?.searchConsoleLastSyncAt?.toISOString() ?? null,
    pageSpeedLastSyncAt: integration?.pageSpeedLastSyncAt?.toISOString() ?? null,
    pageSpeedAvailable: Boolean(
      integration?.isActive &&
        integration.refreshToken &&
        resolvePageSpeedStoreUrl({
          searchConsoleSiteUrl: integration.searchConsoleSiteUrl,
          shopifyDomain,
        }),
    ),
    isActive: integration?.isActive ?? false,
    needsPropertySelection: Boolean(integration?.isActive && !integration?.analyticsPropertyId),
    needsSearchConsolePropertySelection: Boolean(
      integration?.isActive && !integration?.searchConsoleSiteUrl,
    ),
    googleAnalyticsSkipped: Boolean(googleAnalyticsSkippedAt),
  };
}

export async function beginGoogleOAuth(input: {
  storeId: string;
  shop: string;
}): Promise<string> {
  if (!isGoogleOAuthConfigured()) {
    throw new GoogleApiError({
      code: "configuration_missing",
      message: "Google OAuth is not configured for this environment",
      retryable: false,
    });
  }

  return buildGoogleOAuthAuthorizationUrl(input);
}

export async function completeGoogleOAuthCallback(input: {
  code: string;
  state: string;
}): Promise<{
  storeId: string;
  shop: string;
  properties: GoogleAnalyticsPropertySummary[];
}> {
  const parsedState = parseGoogleOAuthState(input.state);

  const store = await prisma.store.findUnique({
    where: { id: parsedState.storeId },
    select: { id: true, shopifyDomain: true, active: true },
  });

  if (!store || store.shopifyDomain !== parsedState.shop) {
    throw new GoogleApiError({
      code: "invalid_response",
      message: "OAuth callback store binding mismatch",
      retryable: false,
    });
  }

  if (!store.active) {
    throw new GoogleApiError({
      code: "invalid_response",
      message: "Store is inactive",
      retryable: false,
    });
  }

  const tokenResponse = await exchangeGoogleOAuthCode(input.code);

  if (!tokenResponse.refresh_token) {
    throw new GoogleApiError({
      code: "invalid_response",
      message: "Google OAuth did not return a refresh token",
      retryable: false,
    });
  }

  const userInfo = await fetchGoogleUserInfo(tokenResponse.access_token);
  const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);

  await prisma.googleIntegration.upsert({
    where: { storeId: parsedState.storeId },
    create: {
      storeId: parsedState.storeId,
      googleAccountId: userInfo.sub,
      email: userInfo.email,
      refreshToken: encryptSecretToken(tokenResponse.refresh_token),
      accessToken: encryptSecretToken(tokenResponse.access_token),
      expiresAt,
      isActive: true,
    },
    update: {
      googleAccountId: userInfo.sub,
      email: userInfo.email,
      refreshToken: encryptSecretToken(tokenResponse.refresh_token),
      accessToken: encryptSecretToken(tokenResponse.access_token),
      expiresAt,
      analyticsPropertyId: null,
      analyticsPropertyName: null,
      searchConsoleSiteUrl: null,
      searchConsoleSiteName: null,
      searchConsoleLastSyncAt: null,
      pageSpeedLastSyncAt: null,
      isActive: true,
      connectedAt: new Date(),
    },
  });

  await prisma.storeOnboarding.updateMany({
    where: { storeId: parsedState.storeId },
    data: { googleAnalyticsSkippedAt: null },
  }).catch(async () => {
    const existing = await prisma.storeOnboarding.findUnique({
      where: { storeId: parsedState.storeId },
    });
    if (existing) {
      await prisma.storeOnboarding.update({
        where: { storeId: parsedState.storeId },
        data: { googleAnalyticsSkippedAt: null },
      });
    }
  });

  const properties = await listGoogleAnalyticsProperties(tokenResponse.access_token);

  logGoogleIntegrationEvent("Google OAuth completed", {
    storeId: parsedState.storeId,
    operation: "google_oauth_completed",
    propertyCount: properties.length,
  });

  return {
    storeId: parsedState.storeId,
    shop: parsedState.shop,
    properties,
  };
}

export async function saveGoogleAnalyticsProperty(input: {
  storeId: string;
  propertyId: string;
  propertyName: string;
}): Promise<GoogleIntegrationPublicView> {
  const integration = await prisma.googleIntegration.update({
    where: { storeId: input.storeId },
    data: {
      analyticsPropertyId: input.propertyId,
      analyticsPropertyName: input.propertyName,
      isActive: true,
    },
  });

  logGoogleIntegrationEvent("Google Analytics property selected", {
    storeId: input.storeId,
    operation: "google_property_selected",
    analyticsPropertyId: input.propertyId,
  });

  return serializeGoogleIntegrationPublicView(integration, null);
}

export async function saveGoogleSearchConsoleProperty(input: {
  storeId: string;
  siteUrl: string;
  siteName: string;
}): Promise<GoogleIntegrationPublicView> {
  const integration = await prisma.googleIntegration.update({
    where: { storeId: input.storeId },
    data: {
      searchConsoleSiteUrl: input.siteUrl,
      searchConsoleSiteName: input.siteName,
      isActive: true,
    },
  });

  logGoogleIntegrationEvent("Google Search Console property selected", {
    storeId: input.storeId,
    operation: "google_search_console_property_selected",
    searchConsoleSiteUrl: input.siteUrl,
  });

  return serializeGoogleIntegrationPublicView(integration, null);
}

export async function disconnectGoogleIntegration(storeId: string): Promise<void> {
  await prisma.googleIntegration.deleteMany({ where: { storeId } });

  logGoogleIntegrationEvent("Google integration disconnected", {
    storeId,
    operation: "google_disconnected",
  });
}

export async function skipGoogleAnalyticsOnboarding(storeId: string): Promise<void> {
  const existing = await prisma.storeOnboarding.findUnique({ where: { storeId } });

  if (existing) {
    await prisma.storeOnboarding.update({
      where: { storeId },
      data: { googleAnalyticsSkippedAt: new Date() },
    });
  } else {
    await prisma.storeOnboarding.create({
      data: {
        storeId,
        onboardingRunId: randomUUID(),
        googleAnalyticsSkippedAt: new Date(),
      },
    });
  }

  logGoogleIntegrationEvent("Google Analytics onboarding skipped", {
    storeId,
    operation: "google_onboarding_skipped",
  });
}

export async function loadActiveGoogleIntegrationForConnector(
  storeId: string,
): Promise<GoogleIntegration | null> {
  return prisma.googleIntegration.findFirst({
    where: {
      storeId,
      isActive: true,
      analyticsPropertyId: { not: null },
    },
  });
}

export async function loadActiveGoogleIntegrationForGscConnector(
  storeId: string,
): Promise<GoogleIntegration | null> {
  return prisma.googleIntegration.findFirst({
    where: {
      storeId,
      isActive: true,
      searchConsoleSiteUrl: { not: null },
    },
  });
}

export async function loadActiveGoogleIntegrationForPageSpeedConnector(
  storeId: string,
): Promise<GoogleIntegration | null> {
  return prisma.googleIntegration.findFirst({
    where: {
      storeId,
      isActive: true,
      refreshToken: { not: "" },
    },
  });
}

export async function resolvePageSpeedStoreUrlForConnector(
  storeId: string,
  integration: GoogleIntegration,
  contextPageUrl?: string,
): Promise<string | null> {
  if (contextPageUrl?.trim()) {
    return resolvePageSpeedStoreUrl({ pageUrl: contextPageUrl });
  }

  if (integration.searchConsoleSiteUrl) {
    return resolvePageSpeedStoreUrl({
      searchConsoleSiteUrl: integration.searchConsoleSiteUrl,
    });
  }

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { shopifyDomain: true },
  });

  return resolvePageSpeedStoreUrl({
    shopifyDomain: store?.shopifyDomain ?? null,
  });
}

export async function syncGoogleAnalyticsForStore(storeId: string): Promise<{
  syncedAt: string;
}> {
  const integration = await loadActiveGoogleIntegrationForConnector(storeId);
  if (!integration?.analyticsPropertyId) {
    throw new GoogleApiError({
      code: "missing_property",
      message: "Google Analytics property is not configured",
      retryable: false,
    });
  }

  bootstrapConnectorPlatform();
  const result = await syncStoreConnectors(
    {
      storeId,
      propertyId: integration.analyticsPropertyId,
    },
    {
      connectorIds: ["ga4"],
      useCache: false,
      forceRefresh: true,
    },
  );

  const ga4Run = result.runs.find((run) => run.connectorId === "ga4");
  if (ga4Run?.status !== "success") {
    throw new GoogleApiError({
      code: ga4Run?.error?.includes("quota") ? "quota_exceeded" : "network_failure",
      message: ga4Run?.error ?? "Google Analytics sync failed",
      retryable: true,
    });
  }

  const syncedAt = new Date();
  await prisma.googleIntegration.update({
    where: { storeId },
    data: { lastSyncAt: syncedAt },
  });

  logGoogleIntegrationEvent("Google Analytics synced", {
    storeId,
    operation: "google_analytics_synced",
    syncedAt: syncedAt.toISOString(),
  });

  return { syncedAt: syncedAt.toISOString() };
}

export async function syncGoogleSearchConsoleForStore(storeId: string): Promise<{
  syncedAt: string;
}> {
  const integration = await loadActiveGoogleIntegrationForGscConnector(storeId);
  if (!integration?.searchConsoleSiteUrl) {
    throw new GoogleApiError({
      code: "missing_property",
      message: "Google Search Console property is not configured",
      retryable: false,
    });
  }

  bootstrapConnectorPlatform();
  const result = await syncStoreConnectors(
    {
      storeId,
      siteUrl: integration.searchConsoleSiteUrl,
    },
    {
      connectorIds: ["gsc"],
      useCache: false,
      forceRefresh: true,
    },
  );

  const gscRun = result.runs.find((run) => run.connectorId === "gsc");
  if (gscRun?.status !== "success") {
    throw new GoogleApiError({
      code: gscRun?.error?.includes("quota") ? "quota_exceeded" : "network_failure",
      message: gscRun?.error ?? "Google Search Console sync failed",
      retryable: true,
    });
  }

  const syncedAt = new Date();
  await prisma.googleIntegration.update({
    where: { storeId },
    data: { searchConsoleLastSyncAt: syncedAt },
  });

  logGoogleIntegrationEvent("Google Search Console synced", {
    storeId,
    operation: "google_search_console_synced",
    syncedAt: syncedAt.toISOString(),
  });

  return { syncedAt: syncedAt.toISOString() };
}

export async function syncGooglePageSpeedForStore(storeId: string): Promise<{
  syncedAt: string;
}> {
  const integration = await loadActiveGoogleIntegrationForPageSpeedConnector(storeId);
  if (!integration) {
    throw new GoogleApiError({
      code: "missing_property",
      message: "Google PageSpeed is not connected",
      retryable: false,
    });
  }

  const pageUrl = await resolvePageSpeedStoreUrlForConnector(storeId, integration);
  if (!pageUrl) {
    throw new GoogleApiError({
      code: "missing_property",
      message: "Storefront URL is required for PageSpeed analysis",
      retryable: false,
    });
  }

  bootstrapConnectorPlatform();
  const result = await syncStoreConnectors(
    {
      storeId,
      pageUrl,
    },
    {
      connectorIds: ["pagespeed"],
      useCache: false,
      forceRefresh: true,
    },
  );

  const pageSpeedRun = result.runs.find((run) => run.connectorId === "pagespeed");
  if (pageSpeedRun?.status !== "success") {
    throw new GoogleApiError({
      code: pageSpeedRun?.error?.includes("quota") ? "quota_exceeded" : "network_failure",
      message: pageSpeedRun?.error ?? "Google PageSpeed sync failed",
      retryable: true,
    });
  }

  const syncedAt = new Date();
  await prisma.googleIntegration.update({
    where: { storeId },
    data: { pageSpeedLastSyncAt: syncedAt },
  });

  logGoogleIntegrationEvent("Google PageSpeed synced", {
    storeId,
    operation: "google_pagespeed_synced",
    syncedAt: syncedAt.toISOString(),
  });

  return { syncedAt: syncedAt.toISOString() };
}

export async function listSelectableGoogleAnalyticsProperties(
  storeId: string,
): Promise<GoogleAnalyticsPropertySummary[]> {
  const integration = await prisma.googleIntegration.findUnique({ where: { storeId } });
  if (!integration) {
    throw new GoogleApiError({
      code: "missing_property",
      message: "Google integration not found",
      retryable: false,
    });
  }

  const token = await getValidGoogleAccessToken(integration);
  return listGoogleAnalyticsProperties(token.accessToken);
}

export async function listSelectableSearchConsoleSites(storeId: string) {
  const integration = await prisma.googleIntegration.findUnique({ where: { storeId } });
  if (!integration) {
    throw new GoogleApiError({
      code: "missing_property",
      message: "Google integration not found",
      retryable: false,
    });
  }

  const token = await getValidGoogleAccessToken(integration);
  return listGscSites(token.accessToken);
}

export async function fetchGa4ReportForStore(storeId: string) {
  const integration = await loadActiveGoogleIntegrationForConnector(storeId);
  if (!integration?.analyticsPropertyId) {
    throw new GoogleApiError({
      code: "missing_property",
      message: "Google Analytics is not connected",
      retryable: false,
    });
  }

  const token = await getValidGoogleAccessToken(integration);
  const raw = await fetchGa4AnalyticsReport({
    propertyId: integration.analyticsPropertyId,
    accessToken: token.accessToken,
  });

  return parseGa4Report(raw);
}

export async function markGoogleIntegrationRevoked(storeId: string, reason: string): Promise<void> {
  await prisma.googleIntegration.updateMany({
    where: { storeId },
    data: { isActive: false },
  });

  logGoogleIntegrationError("Google integration revoked", {
    storeId,
    operation: "google_integration_revoked",
    reason,
  });
}

export function redactGoogleIntegrationForLogs(
  integration: GoogleIntegration | null,
): Record<string, unknown> | null {
  if (!integration) return null;

  return {
    storeId: integration.storeId,
    email: integration.email,
    analyticsPropertyId: integration.analyticsPropertyId,
    analyticsPropertyName: integration.analyticsPropertyName,
    isActive: integration.isActive,
    connectedAt: integration.connectedAt.toISOString(),
    lastSyncAt: integration.lastSyncAt?.toISOString() ?? null,
    hasRefreshToken: Boolean(integration.refreshToken),
    hasAccessToken: Boolean(integration.accessToken),
  };
}

export async function ensureGoogleAccessTokenPersisted(storeId: string): Promise<string> {
  const integration = await prisma.googleIntegration.findUnique({ where: { storeId } });
  if (!integration) {
    throw new GoogleApiError({
      code: "missing_property",
      message: "Google integration not found",
      retryable: false,
    });
  }

  const bundle = await getValidGoogleAccessToken(integration);
  if (decryptSecretToken(integration.accessToken) !== bundle.accessToken) {
    await persistGoogleTokens({
      storeId,
      accessToken: bundle.accessToken,
      expiresInSeconds: Math.max(60, Math.floor((bundle.expiresAt.getTime() - Date.now()) / 1000)),
    });
  }

  return bundle.accessToken;
}
