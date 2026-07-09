import { beforeEach, describe, expect, it } from "vitest";

import { STORE_ID, testHarness } from "./helpers/fixtures";
import {
  disconnectGoogleIntegration,
  getGoogleIntegrationPublicView,
  saveGoogleAnalyticsProperty,
  saveGoogleSearchConsoleProperty,
  serializeGoogleIntegrationPublicView,
  skipGoogleAnalyticsOnboarding,
} from "../google-integration.server";
import { encryptSecretToken } from "../token-crypto.server";

describe("Google integration service", () => {
  beforeEach(() => {
    testHarness().resetDbState();
    process.env.GOOGLE_CLIENT_ID = "google-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "google-client-secret";
    process.env.SHOPIFY_APP_URL = "https://store-pilot.test";
    process.env.TOKEN_ENCRYPTION_KEY = "test-token-encryption-key";
  });

  it("returns a disconnected public view by default", async () => {
    const view = await getGoogleIntegrationPublicView(STORE_ID);

    expect(view.connected).toBe(false);
    expect(view.configured).toBe(true);
    expect(view.googleAnalyticsSkipped).toBe(false);
  });

  it("saves analytics property selection after OAuth", async () => {
    const harness = testHarness();
    harness.dbState.googleIntegrations.set(STORE_ID, {
      id: "integration-1",
      storeId: STORE_ID,
      googleAccountId: "acct-1",
      email: "merchant@store.com",
      refreshToken: encryptSecretToken("refresh-token"),
      accessToken: encryptSecretToken("access-token"),
      expiresAt: new Date(Date.now() + 3600_000),
      connectedAt: new Date(),
      lastSyncAt: null,
      analyticsPropertyId: null,
      analyticsPropertyName: null,
      searchConsoleSiteUrl: null,
      searchConsoleSiteName: null,
      searchConsoleLastSyncAt: null,
      pageSpeedLastSyncAt: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const view = await saveGoogleAnalyticsProperty({
      storeId: STORE_ID,
      propertyId: "123456789",
      propertyName: "Main Store Property",
    });

    expect(view.analyticsPropertyId).toBe("123456789");
    expect(view.analyticsPropertyName).toBe("Main Store Property");
    expect(view.needsPropertySelection).toBe(false);
  });

  it("saves Search Console property selection", async () => {
    const harness = testHarness();
    harness.dbState.googleIntegrations.set(STORE_ID, {
      id: "integration-1",
      storeId: STORE_ID,
      googleAccountId: "acct-1",
      email: "merchant@store.com",
      refreshToken: encryptSecretToken("refresh-token"),
      accessToken: encryptSecretToken("access-token"),
      expiresAt: new Date(Date.now() + 3600_000),
      connectedAt: new Date(),
      lastSyncAt: null,
      analyticsPropertyId: "123456789",
      analyticsPropertyName: "Main Property",
      searchConsoleSiteUrl: null,
      searchConsoleSiteName: null,
      searchConsoleLastSyncAt: null,
      pageSpeedLastSyncAt: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const view = await saveGoogleSearchConsoleProperty({
      storeId: STORE_ID,
      siteUrl: "https://store.example.com/",
      siteName: "https://store.example.com/",
    });

    expect(view.searchConsoleSiteUrl).toBe("https://store.example.com/");
    expect(view.needsSearchConsolePropertySelection).toBe(false);
  });

  it("disconnects an existing integration", async () => {
    const harness = testHarness();
    harness.dbState.googleIntegrations.set(STORE_ID, {
      id: "integration-1",
      storeId: STORE_ID,
      googleAccountId: "acct-1",
      email: "merchant@store.com",
      refreshToken: encryptSecretToken("refresh-token"),
      accessToken: encryptSecretToken("access-token"),
      expiresAt: new Date(Date.now() + 3600_000),
      connectedAt: new Date(),
      lastSyncAt: new Date(),
      analyticsPropertyId: "123456789",
      analyticsPropertyName: "Main Store Property",
      searchConsoleSiteUrl: "https://store.example.com/",
      searchConsoleSiteName: "https://store.example.com/",
      searchConsoleLastSyncAt: new Date(),
      pageSpeedLastSyncAt: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await disconnectGoogleIntegration(STORE_ID);
    const view = await getGoogleIntegrationPublicView(STORE_ID);

    expect(view.connected).toBe(false);
    expect(view.analyticsPropertyId).toBeNull();
  });

  it("records skipped onboarding state", async () => {
    await skipGoogleAnalyticsOnboarding(STORE_ID);
    const view = await getGoogleIntegrationPublicView(STORE_ID);

    expect(view.googleAnalyticsSkipped).toBe(true);
  });

  it("serializes public views without token fields", () => {
    const view = serializeGoogleIntegrationPublicView(
      {
        id: "integration-1",
        storeId: STORE_ID,
        googleAccountId: "acct-1",
        email: "merchant@store.com",
        refreshToken: encryptSecretToken("refresh-token"),
        accessToken: encryptSecretToken("access-token"),
        expiresAt: new Date(Date.now() + 3600_000),
        connectedAt: new Date(),
        lastSyncAt: new Date(),
        analyticsPropertyId: "123456789",
        analyticsPropertyName: "Main Store Property",
        searchConsoleSiteUrl: "https://store.example.com/",
        searchConsoleSiteName: "https://store.example.com/",
        searchConsoleLastSyncAt: new Date(),
        pageSpeedLastSyncAt: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      null,
    );

    expect(view.connected).toBe(true);
    expect(JSON.stringify(view)).not.toContain("refresh-token");
    expect(JSON.stringify(view)).not.toContain("access-token");
  });
});

describe("Google integration reconnect intent", () => {
  it("marks inactive integrations as disconnected in public view", () => {
    const view = serializeGoogleIntegrationPublicView(
      {
        id: "integration-1",
        storeId: STORE_ID,
        googleAccountId: "acct-1",
        email: "merchant@store.com",
        refreshToken: encryptSecretToken("refresh-token"),
        accessToken: encryptSecretToken("access-token"),
        expiresAt: new Date(Date.now() + 3600_000),
        connectedAt: new Date(),
        lastSyncAt: null,
        analyticsPropertyId: "123456789",
        analyticsPropertyName: "Main Store Property",
        searchConsoleSiteUrl: "https://store.example.com/",
        searchConsoleSiteName: "https://store.example.com/",
        searchConsoleLastSyncAt: null,
        pageSpeedLastSyncAt: null,
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      null,
    );

    expect(view.connected).toBe(false);
    expect(view.isActive).toBe(false);
  });
});
