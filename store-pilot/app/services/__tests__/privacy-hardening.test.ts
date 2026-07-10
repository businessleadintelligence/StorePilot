import { describe, expect, it } from "vitest";

import {
  assertJsonPayloadFreeOfCustomerPii,
  scanJsonPayloadForCustomerPii,
} from "../../lib/json-pii-guard.server";
import { customerDataExportExpiresAt } from "../../lib/privacy-retention";
import { orderWhereForMetrics } from "../../lib/order-query-filters.server";
import {
  deriveMerchantAliasFromShop,
  stripMerchantSessionPii,
} from "../../lib/merchant-identity.server";
import { detectShopifyScopeDrift } from "../scope-drift-monitor.server";

describe("privacy hardening", () => {
  it("assertJsonPayloadFreeOfCustomerPii rejects prohibited field names", () => {
    expect(() =>
      assertJsonPayloadFreeOfCustomerPii({ customerEmail: "x@example.com" }),
    ).toThrow(/json_payload_contains_prohibited_pii_fields/);
  });

  it("assertJsonPayloadFreeOfCustomerPii rejects email-like string values", () => {
    expect(() =>
      assertJsonPayloadFreeOfCustomerPii({ note: "Contact user@example.com" }),
    ).toThrow(/json_payload_contains_prohibited_pii_values/);
  });

  it("scanJsonPayloadForCustomerPii reports violations without throwing", () => {
    const scan = scanJsonPayloadForCustomerPii({
      nested: { phone: "555-123-4567" },
    });
    expect(scan.fieldPaths).toContain("nested.phone");
  });

  it("orderWhereForMetrics excludes privacy-redacted orders", () => {
    expect(orderWhereForMetrics("store-1", { isPaid: true })).toEqual({
      storeId: "store-1",
      privacyRedacted: false,
      isPaid: true,
    });
  });

  it("customerDataExportExpiresAt defaults to 30 days", () => {
    const now = new Date("2026-07-10T00:00:00.000Z");
    const expiresAt = customerDataExportExpiresAt(now);
    expect(expiresAt.toISOString()).toBe("2026-08-09T00:00:00.000Z");
  });

  it("deriveMerchantAliasFromShop avoids personal names", () => {
    expect(deriveMerchantAliasFromShop("acme.myshopify.com")).toBe(
      "Store Owner (acme)",
    );
  });

  it("stripMerchantSessionPii clears session first and last names", () => {
    const session = stripMerchantSessionPii({
      id: "offline_acme.myshopify.com",
      shop: "acme.myshopify.com",
      state: "signed",
      isOnline: false,
      accessToken: "token",
      scope: "read_orders",
      firstName: "Jane",
      lastName: "Doe",
    } as unknown as Parameters<typeof stripMerchantSessionPii>[0]);

    expect((session as { firstName?: string | null }).firstName).toBeNull();
    expect((session as { lastName?: string | null }).lastName).toBeNull();
  });

  it("detectShopifyScopeDrift flags prohibited scopes", () => {
    const report = detectShopifyScopeDrift({
      SCOPES: "read_orders,read_customers",
    });
    expect(report.ok).toBe(false);
    expect(report.prohibitedInEnv).toContain("read_customers");
  });
});
