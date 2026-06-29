import { beforeEach, describe, expect, it, vi } from "vitest";

import { BILLING_CONFIG } from "../../billing/plan-config";
import { loader } from "../app.billing";
import { authenticate } from "../../shopify.server";
import { getBillingDashboard } from "../../billing/billing-service";

vi.mock("../../shopify.server", () => ({
  authenticate: { admin: vi.fn() },
}));

vi.mock("../../db.server", () => ({
  default: {
    store: { findUnique: vi.fn() },
  },
}));

vi.mock("../../billing/billing-service", () => ({
  getBillingDashboard: vi.fn(),
  serializeBillingDashboardForRoute: (dashboard: unknown) => dashboard,
  handleBillingAction: vi.fn(),
}));

beforeEach(() => vi.clearAllMocks());

describe("Billing route", () => {
  it("loads billing dashboard without invoking AI", async () => {
    vi.mocked(authenticate.admin).mockResolvedValue({
      session: { shop: "storepilot-test.myshopify.com" },
    } as never);
    const prisma = (await import("../../db.server")).default;
    vi.mocked(prisma.store.findUnique).mockResolvedValue({ id: "store-test-001" } as never);
    vi.mocked(getBillingDashboard).mockResolvedValue({
      storeId: "store-test-001",
      currentPlan: { name: "Growth", monthlyPriceUsd: BILLING_CONFIG.plans.growth.price },
    } as never);

    const data = await loader({ request: new Request("http://localhost/app/billing") } as never);

    expect(getBillingDashboard).toHaveBeenCalledWith("store-test-001");
    expect(data.billingDashboard?.currentPlan.monthlyPriceUsd).toBe(BILLING_CONFIG.plans.growth.price);
  });
});
