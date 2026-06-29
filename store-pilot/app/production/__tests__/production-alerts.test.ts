import { describe, expect, it } from "vitest";

import { generateProductionAlerts } from "../production-alerts";
import { buildSubsystem, buildSnapshot } from "./helpers";

describe("production alerts", () => {
  it("generates critical alert for offline connectors", () => {
    const subsystems = [
      buildSubsystem({ id: "ga4", label: "Google Analytics", level: "offline", healthScore: 10 }),
    ];
    const alerts = generateProductionAlerts({
      subsystems,
      dataQuality: buildSnapshot().dataQuality,
    });

    expect(alerts.some((alert) => alert.title.includes("disconnected"))).toBe(true);
    expect(alerts[0]?.severity).toBe("critical");
  });

  it("generates data quality alert below threshold", () => {
    const alerts = generateProductionAlerts({
      subsystems: [buildSubsystem({ id: "shopify", label: "Shopify" })],
      dataQuality: {
        ...buildSnapshot().dataQuality,
        score: 55,
      },
    });

    expect(alerts.some((alert) => alert.title.includes("Data quality below threshold"))).toBe(true);
  });

  it("generates info alert when no AI runs today", () => {
    const alerts = generateProductionAlerts({
      subsystems: [
        buildSubsystem({
          id: "ai_platform",
          label: "AI Platform",
          details: { runsToday: 0 },
        }),
      ],
      dataQuality: buildSnapshot().dataQuality,
    });

    expect(alerts.some((alert) => alert.title.includes("No AI agent executions today"))).toBe(true);
  });

  it("sorts alerts by severity", () => {
    const alerts = generateProductionAlerts({
      subsystems: [
        buildSubsystem({ id: "shopify", label: "Shopify", level: "offline", healthScore: 10 }),
        buildSubsystem({ id: "ga4", label: "Google Analytics", level: "warning", healthScore: 70 }),
      ],
      dataQuality: { ...buildSnapshot().dataQuality, score: 40 },
    });

    expect(["emergency", "critical"]).toContain(alerts[0]?.severity);
  });
});
