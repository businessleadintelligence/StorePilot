import prisma from "../db.server";
import {
  encryptSecretToken,
  isTokenEncryptionConfigured,
} from "./token-crypto.server";

const ENCRYPTED_PREFIX = "spenc:v1:";

export type TokenMigrationResult = {
  migratedStores: number;
  migratedSessions: number;
  migratedGoogleIntegrations: number;
  migratedClarityIntegrations: number;
  skipped: boolean;
};

function needsEncryption(value: string | null | undefined): value is string {
  return Boolean(value && !value.startsWith(ENCRYPTED_PREFIX));
}

export async function migratePlaintextSecretTokens(): Promise<TokenMigrationResult> {
  if (!isTokenEncryptionConfigured()) {
    return {
      migratedStores: 0,
      migratedSessions: 0,
      migratedGoogleIntegrations: 0,
      migratedClarityIntegrations: 0,
      skipped: true,
    };
  }

  let migratedStores = 0;
  let migratedSessions = 0;
  let migratedGoogleIntegrations = 0;
  let migratedClarityIntegrations = 0;

  const stores = await prisma.store.findMany({
    select: { id: true, accessToken: true },
  });

  for (const store of stores) {
    if (!needsEncryption(store.accessToken)) {
      continue;
    }

    await prisma.store.update({
      where: { id: store.id },
      data: { accessToken: encryptSecretToken(store.accessToken) },
    });
    migratedStores += 1;
  }

  const sessions = await prisma.session.findMany({
    select: { id: true, accessToken: true, refreshToken: true },
  });

  for (const session of sessions) {
    const accessToken = needsEncryption(session.accessToken)
      ? encryptSecretToken(session.accessToken)
      : session.accessToken;
    const refreshToken = needsEncryption(session.refreshToken)
      ? encryptSecretToken(session.refreshToken)
      : session.refreshToken;

    if (
      accessToken !== session.accessToken ||
      refreshToken !== session.refreshToken
    ) {
      await prisma.session.update({
        where: { id: session.id },
        data: {
          accessToken,
          refreshToken,
        },
      });
      migratedSessions += 1;
    }
  }

  const googleIntegrations = await prisma.googleIntegration.findMany({
    select: { id: true, accessToken: true, refreshToken: true },
  });

  for (const integration of googleIntegrations) {
    const accessToken = needsEncryption(integration.accessToken)
      ? encryptSecretToken(integration.accessToken)
      : integration.accessToken;
    const refreshToken = needsEncryption(integration.refreshToken)
      ? encryptSecretToken(integration.refreshToken)
      : integration.refreshToken;

    if (
      accessToken !== integration.accessToken ||
      refreshToken !== integration.refreshToken
    ) {
      await prisma.googleIntegration.update({
        where: { id: integration.id },
        data: {
          accessToken,
          refreshToken,
        },
      });
      migratedGoogleIntegrations += 1;
    }
  }

  const clarityIntegrations = await prisma.microsoftClarityIntegration.findMany({
    select: { id: true, apiToken: true },
  });

  for (const integration of clarityIntegrations) {
    if (!needsEncryption(integration.apiToken)) {
      continue;
    }

    await prisma.microsoftClarityIntegration.update({
      where: { id: integration.id },
      data: { apiToken: encryptSecretToken(integration.apiToken) },
    });
    migratedClarityIntegrations += 1;
  }

  return {
    migratedStores,
    migratedSessions,
    migratedGoogleIntegrations,
    migratedClarityIntegrations,
    skipped: false,
  };
}

export async function countPlaintextSecretTokens(): Promise<number> {
  const [stores, sessions, google, clarity] = await Promise.all([
    prisma.store.findMany({ select: { accessToken: true } }),
    prisma.session.findMany({ select: { accessToken: true, refreshToken: true } }),
    prisma.googleIntegration.findMany({
      select: { accessToken: true, refreshToken: true },
    }),
    prisma.microsoftClarityIntegration.findMany({ select: { apiToken: true } }),
  ]);

  let count = 0;

  for (const store of stores) {
    if (needsEncryption(store.accessToken)) count += 1;
  }

  for (const session of sessions) {
    if (needsEncryption(session.accessToken)) count += 1;
    if (needsEncryption(session.refreshToken)) count += 1;
  }

  for (const integration of google) {
    if (needsEncryption(integration.accessToken)) count += 1;
    if (needsEncryption(integration.refreshToken)) count += 1;
  }

  for (const integration of clarity) {
    if (needsEncryption(integration.apiToken)) count += 1;
  }

  return count;
}
