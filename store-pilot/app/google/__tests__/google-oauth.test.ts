import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildGoogleOAuthAuthorizationUrl,
  createGoogleOAuthState,
  parseGoogleOAuthState,
} from "../oauth/google-oauth.service";
import { refreshGoogleAccessToken } from "../oauth/google-refresh.service";
import { setGoogleHttpFetchImplementation } from "../shared/google-http";

describe("Google OAuth platform", () => {
  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = "google-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "google-client-secret";
    process.env.SHOPIFY_APP_URL = "https://store-pilot.test";
    process.env.TOKEN_ENCRYPTION_KEY = "test-token-encryption-key";
    setGoogleHttpFetchImplementation(null);
  });

  it("builds an authorization URL with analytics and search console readonly scopes", () => {
    const url = buildGoogleOAuthAuthorizationUrl({
      storeId: "store-1",
      shop: "demo.myshopify.com",
    });

    expect(url).toContain("accounts.google.com/o/oauth2/v2/auth");
    expect(url).toContain("analytics.readonly");
    expect(url).toContain("webmasters.readonly");
  });

  it("creates and validates signed OAuth state", () => {
    const state = createGoogleOAuthState({
      storeId: "store-1",
      shop: "demo.myshopify.com",
      now: Date.now(),
    });

    expect(parseGoogleOAuthState(state).storeId).toBe("store-1");
  });

  it("refreshes access tokens through the token endpoint", async () => {
    setGoogleHttpFetchImplementation(async () =>
      Response.json({
        access_token: "new-access-token",
        expires_in: 3600,
        token_type: "Bearer",
      }),
    );

    const refreshed = await refreshGoogleAccessToken("refresh-token");
    expect(refreshed.access_token).toBe("new-access-token");
  });
});
