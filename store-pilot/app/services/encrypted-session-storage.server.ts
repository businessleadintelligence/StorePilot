import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import type { Session } from "@shopify/shopify-api";
import type { SessionStorage } from "@shopify/shopify-app-session-storage";
import type { PrismaClient } from "@prisma/client";

import {
  decryptSecretToken,
  encryptSecretToken,
} from "./token-crypto.server";
import { stripMerchantSessionPii } from "../lib/merchant-identity.server";

function decryptSession(session: Session): Session {
  session.accessToken = decryptSecretToken(session.accessToken);
  if (session.refreshToken) {
    session.refreshToken = decryptSecretToken(session.refreshToken);
  }
  return session;
}

export class EncryptedPrismaSessionStorage implements SessionStorage {
  private readonly storage: PrismaSessionStorage<PrismaClient>;

  constructor(prisma: PrismaClient) {
    this.storage = new PrismaSessionStorage(prisma);
  }

  async storeSession(session: Session): Promise<boolean> {
    const sanitizedSession = stripMerchantSessionPii(session);
    const encryptedAccessToken = encryptSecretToken(sanitizedSession.accessToken);
    const encryptedRefreshToken = sanitizedSession.refreshToken
      ? encryptSecretToken(sanitizedSession.refreshToken)
      : undefined;

    sanitizedSession.accessToken = encryptedAccessToken;
    if (encryptedRefreshToken) {
      sanitizedSession.refreshToken = encryptedRefreshToken;
    }

    try {
      return await this.storage.storeSession(sanitizedSession);
    } finally {
      sanitizedSession.accessToken = decryptSecretToken(encryptedAccessToken);
      if (encryptedRefreshToken) {
        sanitizedSession.refreshToken = decryptSecretToken(encryptedRefreshToken);
      }
    }
  }

  async loadSession(id: string): Promise<Session | undefined> {
    const session = await this.storage.loadSession(id);
    if (!session) {
      return undefined;
    }

    return decryptSession(session);
  }

  async deleteSession(id: string): Promise<boolean> {
    return this.storage.deleteSession(id);
  }

  async deleteSessions(ids: string[]): Promise<boolean> {
    return this.storage.deleteSessions(ids);
  }

  async findSessionsByShop(shop: string): Promise<Session[]> {
    const sessions = await this.storage.findSessionsByShop(shop);
    return sessions.map((session: Session) => decryptSession(session));
  }
}
