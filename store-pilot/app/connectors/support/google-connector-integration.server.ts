import type { GoogleIntegration } from "@prisma/client";

import prisma from "../../db.server";
import { resolvePageSpeedStoreUrl } from "../../google/pagespeed/pagespeed-query-builder";
import { logGoogleIntegrationError } from "../../google/oauth/google-token.service";

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

export async function markGoogleIntegrationRevoked(
  storeId: string,
  reason: string,
): Promise<void> {
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
