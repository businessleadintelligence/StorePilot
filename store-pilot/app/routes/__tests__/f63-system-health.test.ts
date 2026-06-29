import { beforeEach, describe, expect, it, vi } from "vitest";

import { loader } from "../app.system-health";
import { authenticate } from "../../shopify.server";
import { getProductionHealthDashboard } from "../../production/production-service";
import { buildDashboard } from "../../production/__tests__/helpers";

vi.mock("../../shopify.server", () => ({
  authenticate: { admin: vi.fn() },
}));

vi.mock("../../db.server", () => ({
  default: {
    store: { findUnique: vi.fn() },
  },
}));

vi.mock("../../production/production-service", () => ({
  getProductionHealthDashboard: vi.fn(),
  serializeProductionDashboardForRoute: (dashboard: unknown) => dashboard,
}));

vi.mock("../../onboarding/onboarding-service", () => ({
  getOnboardingReminders: vi.fn(async () => []),
  serializeMerchantOnboardingRemindersForLoader: (reminders: unknown) => reminders,
}));

vi.mock("../../onboarding/onboarding-service", () => ({
  getOnboardingReminders: vi.fn(async () => []),
  serializeMerchantOnboardingRemindersForLoader: (reminders: unknown) => reminders,
}));

beforeEach(() => vi.clearAllMocks());

describe("System Health route", () => {
  it("loads persisted production dashboard without invoking AI", async () => {
    vi.mocked(authenticate.admin).mockResolvedValue({
      session: { shop: "storepilot-test.myshopify.com" },
    } as never);
    const prisma = (await import("../../db.server")).default;
    vi.mocked(prisma.store.findUnique).mockResolvedValue({ id: "store-test-001" } as never);
    vi.mocked(getProductionHealthDashboard).mockResolvedValue(buildDashboard());

    const data = await loader({ request: new Request("http://localhost/app/system-health") } as never);

    expect(getProductionHealthDashboard).toHaveBeenCalledWith("store-test-001");
    expect(data.systemHealth).toBeTruthy();
    expect(data.systemHealth?.overallHealthScore).toBeGreaterThan(0);
  });
});
