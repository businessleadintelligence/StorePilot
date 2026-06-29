export type HealthGrade = "A" | "B" | "C" | "D" | "F";

export type InsightSeverity = "critical" | "warning" | "info";

export type RecommendationSeverity = "critical" | "warning" | "info";

export type FounderHealthIndicator = "green" | "yellow" | "red";

export type StartupReadiness = {
  ready: boolean;
  checks: Array<{ id: string; ok: boolean; reason?: string }>;
};

export function getGradeBadgeTone(
  grade: HealthGrade,
): "success" | "info" | "warning" | "critical" | undefined {
  switch (grade) {
    case "A":
    case "B":
      return "success";
    case "C":
      return "info";
    case "D":
      return "warning";
    case "F":
      return "critical";
    default:
      return undefined;
  }
}

export function getInsightBadgeTone(
  severity: InsightSeverity,
): "critical" | "warning" | "info" | undefined {
  switch (severity) {
    case "critical":
      return "critical";
    case "warning":
      return "warning";
    case "info":
      return "info";
    default:
      return undefined;
  }
}

export function getRecommendationBadgeTone(
  severity: RecommendationSeverity,
): "critical" | "warning" | "info" | undefined {
  switch (severity) {
    case "critical":
      return "critical";
    case "warning":
      return "warning";
    case "info":
      return "info";
    default:
      return undefined;
  }
}

export function getJobsHealthIndicator(failedJobs: number): FounderHealthIndicator {
  if (failedJobs <= 0) {
    return "green";
  }

  if (failedJobs <= 5) {
    return "yellow";
  }

  return "red";
}

export function getOnboardingHealthIndicator(
  stuckOnboarding: number,
): FounderHealthIndicator {
  if (stuckOnboarding <= 0) {
    return "green";
  }

  return "red";
}

export function getHealthIndicatorTone(
  indicator: FounderHealthIndicator,
): "success" | "warning" | "critical" | undefined {
  switch (indicator) {
    case "green":
      return "success";
    case "yellow":
      return "warning";
    case "red":
      return "critical";
    default:
      return undefined;
  }
}

export function getStartupHealthIndicator(
  readiness: StartupReadiness,
): "green" | "red" {
  return readiness.ready ? "green" : "red";
}
