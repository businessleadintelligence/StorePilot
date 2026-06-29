import { describe, expect, it, vi } from "vitest";

import { getBillingTrialDays } from "../plan-config";
import {
  createShopifySubscriptionCharge,
  hasDuplicateShopifySubscription,
  isBillingTestMode,
  mapShopifyBillingError,
} from "../shopify-billing.server";

describe("shopify billing api", () => {
  it("runs in test mode outside production", () => {
    expect(isBillingTestMode()).toBe(true);
  });

  it("maps merchant-friendly billing errors", () => {
    expect(mapShopifyBillingError("merchant declined payment")).toContain("declined");
    expect(mapShopifyBillingError("duplicate subscription")).toContain("already exists");
  });

  it("prevents duplicate subscriptions", async () => {
    const admin = {
      graphql: vi.fn(async () =>
        Response.json({
          data: {
            currentAppInstallation: {
              activeSubscriptions: [
                {
                  id: "gid://shopify/AppSubscription/1",
                  name: "StorePilot Growth",
                  status: "ACTIVE",
                  trialDays: getBillingTrialDays(),
                },
              ],
            },
          },
        }),
      ),
    };

    expect(await hasDuplicateShopifySubscription(admin)).toBe(true);
  });

  it("creates subscription charge with explicit confirmation url", async () => {
    const admin = {
      graphql: vi
        .fn()
        .mockResolvedValueOnce(
          Response.json({
            data: { currentAppInstallation: { activeSubscriptions: [] } },
          }),
        )
        .mockResolvedValueOnce(
          Response.json({
            data: {
              appSubscriptionCreate: {
                confirmationUrl: "https://shop.myshopify.com/admin/charges/confirm",
                userErrors: [],
              },
            },
          }),
        ),
    };

    const result = await createShopifySubscriptionCharge({
      admin,
      storeId: "store-test-001",
      shop: "demo.myshopify.com",
      planSlug: "growth",
      returnUrl: "https://app.example.com/app/billing",
      trialDays: getBillingTrialDays("growth"),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.confirmationUrl).toContain("confirm");
    }
  });
});
