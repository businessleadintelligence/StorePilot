import type { MicrosoftClarityIntegration } from "@prisma/client";

import prisma from "../db.server";
import { sanitizeLogContext } from "../lib/privacy-by-architecture";
import {
  bootstrapConnectorPlatform,
  syncStoreConnectors,
} from "../connectors";
import { fetchClarityAnalyticsReport } from "../microsoft/clarity/clarity-client";
import { ClarityApiError } from "../microsoft/clarity/clarity-api-error";
import {
  decryptSecretToken,
  encryptSecretToken,
} from "./token-crypto.server";

export type ClarityIntegrationPublicView = {
  connected: boolean;
  projectId: string | null;
  projectName: string | null;
  connectedAt: string | null;
  lastSyncAt: string | null;
  isActive: boolean;
  needsProjectSelection: boolean;
};

export async function getClarityIntegrationPublicView(
  storeId: string,
): Promise<ClarityIntegrationPublicView> {
  const integration = await prisma.microsoftClarityIntegration.findUnique({ where: { storeId } });
  return serializeClarityIntegrationPublicView(integration);
}

export function serializeClarityIntegrationPublicView(
  integration: MicrosoftClarityIntegration | null,
): ClarityIntegrationPublicView {
  return {
    connected: Boolean(integration?.isActive && integration.apiToken),
    projectId: integration?.projectId ?? null,
    projectName: integration?.projectName ?? null,
    connectedAt: integration?.connectedAt?.toISOString() ?? null,
    lastSyncAt: integration?.lastSyncAt?.toISOString() ?? null,
    isActive: integration?.isActive ?? false,
    needsProjectSelection: Boolean(integration?.isActive && !integration?.projectId),
  };
}

export async function connectMicrosoftClarityIntegration(input: {
  storeId: string;
  projectId: string;
  projectName?: string;
  apiToken: string;
}): Promise<ClarityIntegrationPublicView> {
  const projectId = input.projectId.trim();
  const apiToken = input.apiToken.trim();

  if (!projectId) {
    throw new ClarityApiError({
      code: "missing_project",
      message: "Microsoft Clarity project ID is required",
      retryable: false,
    });
  }

  if (!apiToken) {
    throw new ClarityApiError({
      code: "revoked_credentials",
      message: "Microsoft Clarity API token is required",
      retryable: false,
    });
  }

  const integration = await prisma.microsoftClarityIntegration.upsert({
    where: { storeId: input.storeId },
    create: {
      storeId: input.storeId,
      projectId,
      projectName: input.projectName?.trim() || projectId,
      apiToken: encryptSecretToken(apiToken),
      isActive: true,
    },
    update: {
      projectId,
      projectName: input.projectName?.trim() || projectId,
      apiToken: encryptSecretToken(apiToken),
      isActive: true,
      connectedAt: new Date(),
    },
  });

  logClarityIntegrationEvent("Microsoft Clarity connected", {
    storeId: input.storeId,
    operation: "clarity_connected",
    projectId,
  });

  return serializeClarityIntegrationPublicView(integration);
}

export async function saveMicrosoftClarityProject(input: {
  storeId: string;
  projectId: string;
  projectName?: string;
}): Promise<ClarityIntegrationPublicView> {
  const integration = await prisma.microsoftClarityIntegration.update({
    where: { storeId: input.storeId },
    data: {
      projectId: input.projectId.trim(),
      projectName: input.projectName?.trim() || input.projectId.trim(),
      isActive: true,
    },
  });

  logClarityIntegrationEvent("Microsoft Clarity project selected", {
    storeId: input.storeId,
    operation: "clarity_project_selected",
    projectId: integration.projectId,
  });

  return serializeClarityIntegrationPublicView(integration);
}

export async function disconnectMicrosoftClarityIntegration(storeId: string): Promise<void> {
  await prisma.microsoftClarityIntegration.deleteMany({ where: { storeId } });

  logClarityIntegrationEvent("Microsoft Clarity disconnected", {
    storeId,
    operation: "clarity_disconnected",
  });
}

export async function loadActiveClarityIntegrationForConnector(
  storeId: string,
): Promise<MicrosoftClarityIntegration | null> {
  return prisma.microsoftClarityIntegration.findFirst({
    where: {
      storeId,
      isActive: true,
      projectId: { not: "" },
      apiToken: { not: "" },
    },
  });
}

export function getClarityApiToken(integration: MicrosoftClarityIntegration): string {
  const token = decryptSecretToken(integration.apiToken);
  if (!token) {
    throw new ClarityApiError({
      code: "revoked_credentials",
      message: "Microsoft Clarity API token is unavailable",
      retryable: false,
    });
  }

  return token;
}

export async function syncMicrosoftClarityForStore(storeId: string): Promise<{
  syncedAt: string;
}> {
  const integration = await loadActiveClarityIntegrationForConnector(storeId);
  if (!integration?.projectId) {
    throw new ClarityApiError({
      code: "missing_project",
      message: "Microsoft Clarity project is not configured",
      retryable: false,
    });
  }

  bootstrapConnectorPlatform();
  const result = await syncStoreConnectors(
    {
      storeId,
      projectId: integration.projectId,
    },
    {
      connectorIds: ["clarity"],
      useCache: false,
      forceRefresh: true,
    },
  );

  const clarityRun = result.runs.find((run) => run.connectorId === "clarity");
  if (clarityRun?.status !== "success") {
    throw new ClarityApiError({
      code: clarityRun?.error?.includes("quota") ? "quota_exceeded" : "network_failure",
      message: clarityRun?.error ?? "Microsoft Clarity sync failed",
      retryable: true,
    });
  }

  const syncedAt = new Date();
  await prisma.microsoftClarityIntegration.update({
    where: { storeId },
    data: { lastSyncAt: syncedAt },
  });

  logClarityIntegrationEvent("Microsoft Clarity synced", {
    storeId,
    operation: "clarity_synced",
    syncedAt: syncedAt.toISOString(),
  });

  return { syncedAt: syncedAt.toISOString() };
}

export async function markClarityIntegrationRevoked(storeId: string, reason: string): Promise<void> {
  await prisma.microsoftClarityIntegration.updateMany({
    where: { storeId },
    data: { isActive: false },
  });

  logClarityIntegrationError("Microsoft Clarity integration revoked", {
    storeId,
    operation: "clarity_integration_revoked",
    reason,
  });
}

export function redactClarityIntegrationForLogs(
  integration: MicrosoftClarityIntegration | null,
): Record<string, unknown> | null {
  if (!integration) return null;

  return {
    storeId: integration.storeId,
    projectId: integration.projectId,
    projectName: integration.projectName,
    isActive: integration.isActive,
    connectedAt: integration.connectedAt.toISOString(),
    lastSyncAt: integration.lastSyncAt?.toISOString() ?? null,
    hasApiToken: Boolean(integration.apiToken),
  };
}

export async function fetchClarityReportForStore(storeId: string) {
  const integration = await loadActiveClarityIntegrationForConnector(storeId);
  if (!integration?.projectId) {
    throw new ClarityApiError({
      code: "missing_project",
      message: "Microsoft Clarity is not connected",
      retryable: false,
    });
  }

  return fetchClarityAnalyticsReport({
    projectId: integration.projectId,
    apiToken: getClarityApiToken(integration),
  });
}

function logClarityIntegrationEvent(message: string, context: Record<string, unknown>): void {
  console.info(message, sanitizeLogContext(context));
}

function logClarityIntegrationError(message: string, context: Record<string, unknown>): void {
  console.error(message, sanitizeLogContext(context));
}
