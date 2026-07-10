import type { MicrosoftClarityIntegration } from "@prisma/client";

import prisma from "../../db.server";
import { sanitizeLogContext } from "../../lib/privacy-by-architecture";
import { ClarityApiError } from "../../microsoft/clarity/clarity-api-error";
import { decryptSecretToken } from "../../services/token-crypto.server";

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

export async function markClarityIntegrationRevoked(
  storeId: string,
  reason: string,
): Promise<void> {
  await prisma.microsoftClarityIntegration.updateMany({
    where: { storeId },
    data: { isActive: false },
  });

  console.error(
    "Microsoft Clarity integration revoked",
    sanitizeLogContext({
      storeId,
      operation: "clarity_integration_revoked",
      reason,
    }),
  );
}
