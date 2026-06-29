import { beforeEach, describe, expect, it } from "vitest";

import { STORE_ID, testHarness } from "./helpers/fixtures";
import {
  connectMicrosoftClarityIntegration,
  disconnectMicrosoftClarityIntegration,
  getClarityIntegrationPublicView,
  serializeClarityIntegrationPublicView,
} from "../clarity-integration.server";
import { encryptSecretToken } from "../token-crypto.server";

describe("Clarity integration service", () => {
  beforeEach(() => {
    testHarness().resetDbState();
    process.env.TOKEN_ENCRYPTION_KEY = "test-token-encryption-key";
  });

  it("returns a disconnected public view by default", async () => {
    const view = await getClarityIntegrationPublicView(STORE_ID);

    expect(view.connected).toBe(false);
    expect(view.projectId).toBeNull();
  });

  it("connects a Clarity project with encrypted token storage", async () => {
    const view = await connectMicrosoftClarityIntegration({
      storeId: STORE_ID,
      projectId: "clarity-project-1",
      projectName: "Main Store Clarity",
      apiToken: "clarity-api-token",
    });

    expect(view.connected).toBe(true);
    expect(view.projectId).toBe("clarity-project-1");
    expect(view.projectName).toBe("Main Store Clarity");

    const stored = testHarness().dbState.microsoftClarityIntegrations.get(STORE_ID);
    expect(stored?.apiToken).not.toBe("clarity-api-token");
    expect(stored?.apiToken).toContain("spenc:v1:");
  });

  it("disconnects an existing integration", async () => {
    testHarness().dbState.microsoftClarityIntegrations.set(STORE_ID, {
      id: "integration-1",
      storeId: STORE_ID,
      projectId: "clarity-project-1",
      projectName: "Main Store Clarity",
      apiToken: encryptSecretToken("clarity-api-token"),
      connectedAt: new Date(),
      lastSyncAt: new Date(),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await disconnectMicrosoftClarityIntegration(STORE_ID);
    const view = await getClarityIntegrationPublicView(STORE_ID);

    expect(view.connected).toBe(false);
    expect(view.projectId).toBeNull();
  });

  it("serializes public views without token fields", () => {
    const view = serializeClarityIntegrationPublicView({
      id: "integration-1",
      storeId: STORE_ID,
      projectId: "clarity-project-1",
      projectName: "Main Store Clarity",
      apiToken: encryptSecretToken("clarity-api-token"),
      connectedAt: new Date(),
      lastSyncAt: new Date(),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(view.connected).toBe(true);
    expect(JSON.stringify(view)).not.toContain("clarity-api-token");
  });
});
