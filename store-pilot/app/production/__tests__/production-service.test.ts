import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearProductionHealthCache,
  getProductionHealthDashboard,
} from "../production-service";
import { runProductionHealthEngine } from "../production-engine";
import { buildSubsystem } from "./helpers";

vi.mock("../production-engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../production-engine")>();
  return {
    ...actual,
    runProductionHealthEngine: vi.fn(),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  clearProductionHealthCache();
});

describe("production service", () => {
  it("returns cached dashboard within ttl", async () => {
    vi.mocked(runProductionHealthEngine).mockResolvedValue({
      storeId: "store-test-001",
      computedAt: new Date().toISOString(),
      aggregationDurationMs: 10,
      overallLevel: "healthy",
      overallHealthScore: 95,
      subsystems: [buildSubsystem({ id: "shopify", label: "Shopify" })],
      dataQuality: {
        score: 90,
        completeness: 90,
        freshness: 90,
        reliability: 90,
        missingConnectors: [],
        staleConnectors: [],
        impactChain: [],
      },
      alerts: [],
      syncTimeline: [],
      recoveryActions: [],
    });

    const first = await getProductionHealthDashboard("store-test-001");
    const second = await getProductionHealthDashboard("store-test-001");

    expect(first.overallHealthScore).toBe(95);
    expect(second.overallHealthScore).toBe(95);
    expect(runProductionHealthEngine).toHaveBeenCalledTimes(1);
  });

  it("forces refresh when requested", async () => {
    vi.mocked(runProductionHealthEngine).mockResolvedValue({
      storeId: "store-test-001",
      computedAt: new Date().toISOString(),
      aggregationDurationMs: 10,
      overallLevel: "healthy",
      overallHealthScore: 95,
      subsystems: [],
      dataQuality: {
        score: 90,
        completeness: 90,
        freshness: 90,
        reliability: 90,
        missingConnectors: [],
        staleConnectors: [],
        impactChain: [],
      },
      alerts: [],
      syncTimeline: [],
      recoveryActions: [],
    });

    await getProductionHealthDashboard("store-test-001");
    await getProductionHealthDashboard("store-test-001", { forceRefresh: true });

    expect(runProductionHealthEngine).toHaveBeenCalledTimes(2);
  });
});
