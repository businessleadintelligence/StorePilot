import type { GoogleIntegration } from "@prisma/client";

import prisma from "../../db.server";
import {
  decryptSecretToken,
  encryptSecretToken,
} from "../../services/token-crypto.server";
import { refreshGoogleAccessToken } from "./google-refresh.service";
import { GoogleApiError } from "../shared/google-api-error";

const TOKEN_REFRESH_BUFFER_MS = 1000 * 60;

export type GoogleTokenBundle = {
  accessToken: string;
  expiresAt: Date;
};

function isTokenExpired(expiresAt: Date, referenceTime = Date.now()): boolean {
  return expiresAt.getTime() - TOKEN_REFRESH_BUFFER_MS <= referenceTime;
}

export async function persistGoogleTokens(input: {
  storeId: string;
  accessToken: string;
  refreshToken?: string | null;
  expiresInSeconds: number;
  referenceTime?: number;
}): Promise<void> {
  const referenceTime = input.referenceTime ?? Date.now();
  const expiresAt = new Date(referenceTime + input.expiresInSeconds * 1000);

  await prisma.googleIntegration.update({
    where: { storeId: input.storeId },
    data: {
      accessToken: encryptSecretToken(input.accessToken),
      ...(input.refreshToken ? { refreshToken: encryptSecretToken(input.refreshToken) } : {}),
      expiresAt,
    },
  });
}

export async function getValidGoogleAccessToken(
  integration: Pick<GoogleIntegration, "storeId" | "accessToken" | "refreshToken" | "expiresAt" | "isActive">,
): Promise<GoogleTokenBundle> {
  if (!integration.isActive) {
    throw new GoogleApiError({
      code: "missing_property",
      message: "Google integration is not active",
      retryable: false,
    });
  }

  const currentAccessToken = decryptSecretToken(integration.accessToken);
  const expiresAt = integration.expiresAt;

  if (!isTokenExpired(expiresAt)) {
    return {
      accessToken: currentAccessToken,
      expiresAt,
    };
  }

  const refreshToken = decryptSecretToken(integration.refreshToken);
  if (!refreshToken) {
    throw new GoogleApiError({
      code: "expired_token",
      message: "Google access token expired and refresh token is unavailable",
      retryable: false,
    });
  }

  const refreshed = await refreshGoogleAccessToken(refreshToken);
  const nextExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000);

  await persistGoogleTokens({
    storeId: integration.storeId,
    accessToken: refreshed.access_token,
    expiresInSeconds: refreshed.expires_in,
  });

  return {
    accessToken: refreshed.access_token,
    expiresAt: nextExpiresAt,
  };
}

export function sanitizeGoogleLogContext(
  context: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(context)) {
    if (/token/i.test(key)) continue;
    sanitized[key] = value;
  }

  return sanitized;
}

export function logGoogleIntegrationEvent(
  message: string,
  context: Record<string, unknown>,
): void {
  console.info("[google-integration]", sanitizeGoogleLogContext({ message, ...context }));
}

export function logGoogleIntegrationError(
  message: string,
  context: Record<string, unknown>,
): void {
  console.error("[google-integration]", sanitizeGoogleLogContext({ message, ...context }));
}
