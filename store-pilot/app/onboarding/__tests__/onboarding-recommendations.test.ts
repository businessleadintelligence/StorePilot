import { describe, expect, it, vi } from "vitest";

import { buildOnboardingReminders } from "../onboarding-recommendations";

vi.mock("../../services/google-integration.server", () => ({
  getGoogleIntegrationPublicView: vi.fn(async () => ({
    connected: false,
    configured: false,
    googleAnalyticsSkipped: true,
    lastSyncAt: null,
    searchConsoleSiteUrl: null,
    searchConsoleLastSyncAt: null,
    pageSpeedAvailable: false,
    pageSpeedLastSyncAt: null,
  })),
}));

vi.mock("../../services/clarity-integration.server", () => ({
  getClarityIntegrationPublicView: vi.fn(async () => ({
    connected: false,
    lastSyncAt: null,
  })),
}));

vi.mock("../../production/production-service", () => ({
  getCachedProductionBadge: vi.fn(() => ({
    label: "Healthy",
    level: "healthy",
  })),
}));

describe("onboarding reminders", () => {
  it("builds connector disconnect reminders with data quality impact", async () => {
    const reminders = await buildOnboardingReminders("store-test-001");

    expect(reminders.some((item) => item.message.includes("Google Analytics"))).toBe(true);
    expect(reminders.every((item) => item.href.startsWith("/app"))).toBe(true);
  });
});
