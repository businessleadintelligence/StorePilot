import type {
  ProductionAlert,
  ProductionDataQualityExplanation,
  ProductionHealthSnapshot,
  ProductionSubsystemHealth,
} from "./production-types";

function alert(input: Omit<ProductionAlert, "id" | "createdAt" | "dismissed" | "resolved">): ProductionAlert {
  return {
    id: `alert:${input.subsystemId}:${input.title.replace(/\s+/g, "_").toLowerCase()}`,
    createdAt: new Date().toISOString(),
    dismissed: false,
    resolved: false,
    ...input,
  };
}

export function generateProductionAlerts(input: {
  subsystems: ProductionSubsystemHealth[];
  dataQuality: ProductionDataQualityExplanation;
}): ProductionAlert[] {
  const alerts: ProductionAlert[] = [];

  for (const subsystem of input.subsystems) {
    if (subsystem.level === "offline") {
      alerts.push(
        alert({
          subsystemId: subsystem.id,
          severity: subsystem.id === "shopify" ? "emergency" : "critical",
          title: `${subsystem.label} disconnected`,
          message: subsystem.lastError ?? `${subsystem.label} is offline or not configured.`,
          recoveryAction: subsystem.recoverySuggestion,
        }),
      );
      continue;
    }

    if (subsystem.level === "critical") {
      alerts.push(
        alert({
          subsystemId: subsystem.id,
          severity: "critical",
          title: `${subsystem.label} critical`,
          message: subsystem.lastError ?? `${subsystem.label} requires immediate attention.`,
          recoveryAction: subsystem.recoverySuggestion,
        }),
      );
    }

    if (subsystem.failureCount >= 3) {
      alerts.push(
        alert({
          subsystemId: subsystem.id,
          severity: "warning",
          title: `${subsystem.label} repeated failures`,
          message: `${subsystem.failureCount} failures detected.`,
          recoveryAction: subsystem.recoverySuggestion,
        }),
      );
    }
  }

  if (input.dataQuality.score < 70) {
    alerts.push(
      alert({
        subsystemId: "data_quality",
        severity: input.dataQuality.score < 50 ? "critical" : "warning",
        title: "Data quality below threshold",
        message: `Store data quality score is ${input.dataQuality.score}.`,
        recoveryAction: "Reconnect missing connectors and retry sync from Settings",
      }),
    );
  }

  const aiPlatform = input.subsystems.find((item) => item.id === "ai_platform");
  if (aiPlatform && Number(aiPlatform.details.runsToday ?? 0) <= 0) {
    alerts.push(
      alert({
        subsystemId: "ai_platform",
        severity: "info",
        title: "No AI agent executions today",
        message: "No agent runs were recorded in the last 24 hours.",
        recoveryAction: "Review Command Center scheduling",
      }),
    );
  }

  return alerts.sort((left, right) => severityRank(right.severity) - severityRank(left.severity));
}

function severityRank(severity: ProductionAlert["severity"]): number {
  switch (severity) {
    case "emergency":
      return 4;
    case "critical":
      return 3;
    case "warning":
      return 2;
    default:
      return 1;
  }
}

export function buildRecoveryActions(snapshot: ProductionHealthSnapshot) {
  const actions = new Map<string, { id: string; label: string; href: string | null }>();

  for (const subsystem of snapshot.subsystems) {
    if (!subsystem.recoverySuggestion) continue;
    actions.set(subsystem.id, {
      id: `recovery:${subsystem.id}`,
      label: subsystem.recoverySuggestion,
      href:
        subsystem.id === "shopify"
          ? "/app"
          : ["ga4", "search_console", "pagespeed", "clarity", "oauth_tokens"].includes(subsystem.id)
            ? "/app/settings"
            : subsystem.id === "automation"
              ? "/app/automation"
              : subsystem.id === "operations"
                ? "/app/operations"
                : subsystem.id === "ai_platform"
                  ? "/app/command-center"
                  : "/app/system-health",
    });
  }

  return [...actions.values()];
}
