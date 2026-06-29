import { describe, expect, it } from "vitest";

import { buildSyncTimeline, buildProductionDashboard } from "../production-dashboard";
import { buildDataQualitySubsystem, summarizeProductionHealth } from "../production-health";
import { aggregateHealthScore, badgeFromLevel, levelFromScore } from "../production-status";
import { validateProductionEnvironment } from "../production-security";
import { validateProductionDashboard, validateProductionSnapshot } from "../production-validator";
import { buildSubsystem, buildSnapshot } from "./helpers";

describe("production health scoring", () => {
  it("aggregates subsystem scores", () => {
    expect(aggregateHealthScore([100, 70, 40])).toBe(70);
    expect(levelFromScore(90)).toBe("healthy");
    expect(badgeFromLevel("critical").label).toBe("Critical");
  });

  it("builds data quality subsystem with reduced score", () => {
    const subsystem = buildDataQualitySubsystem({
      score: 55,
      completeness: 50,
      freshness: 60,
      reliability: 55,
      missingConnectors: ["ga4"],
      staleConnectors: [],
      impactChain: ["GA4 missing"],
    });

    expect(subsystem.level).toBe("critical");
    expect(subsystem.recoverySuggestion).toContain("Reconnect");
  });

  it("summarizes overall health from subsystems", () => {
    const summary = summarizeProductionHealth([
      buildSubsystem({ id: "shopify", label: "Shopify", level: "healthy", healthScore: 100 }),
      buildSubsystem({ id: "ga4", label: "GA4", level: "critical", healthScore: 40 }),
    ]);

    expect(summary.overallLevel).toBe("critical");
    expect(summary.overallHealthScore).toBe(70);
  });
});

describe("production dashboard aggregation", () => {
  it("groups subsystems into dashboard sections", () => {
    const dashboard = buildProductionDashboard(
      buildSnapshot({
        subsystems: [
          buildSubsystem({ id: "shopify", label: "Shopify" }),
          buildSubsystem({ id: "ga4", label: "GA4" }),
          buildSubsystem({ id: "webhooks", label: "Webhooks" }),
          buildSubsystem({ id: "ai_platform", label: "AI Platform" }),
          buildSubsystem({ id: "database", label: "Database" }),
        ],
      }),
    );

    expect(dashboard.sections.connectors.length).toBeGreaterThan(0);
    expect(dashboard.sections.pipelines.some((item) => item.id === "webhooks")).toBe(true);
    expect(dashboard.settingsBadge.label).toBeTruthy();
  });

  it("builds sync timeline sorted by recency", () => {
    const timeline = buildSyncTimeline([
      buildSubsystem({
        id: "shopify",
        label: "Shopify",
        lastSync: "2026-01-01T00:00:00.000Z",
      }),
      buildSubsystem({
        id: "ga4",
        label: "GA4",
        lastSync: "2026-06-01T00:00:00.000Z",
      }),
    ]);

    expect(timeline[0]?.label).toBe("GA4");
  });
});

describe("production validation", () => {
  it("validates environment variables", () => {
    const result = validateProductionEnvironment({
      SHOPIFY_API_KEY: "key",
      SHOPIFY_API_SECRET: "secret",
      DATABASE_URL: "postgres",
      TOKEN_ENCRYPTION_KEY: "token-key",
    });

    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it("rejects invalid snapshots", () => {
    const invalid = validateProductionSnapshot({
      ...buildSnapshot(),
      overallHealthScore: 150,
    });
    expect(invalid.ok).toBe(false);
  });

  it("accepts valid dashboard payloads", () => {
    const dashboard = buildProductionDashboard(buildSnapshot());
    const result = validateProductionDashboard(dashboard);
    expect(result.ok).toBe(true);
  });
});
