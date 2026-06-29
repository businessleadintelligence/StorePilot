import type { ProductionHealthLevel } from "./production-types";

export function scoreFromLevel(level: ProductionHealthLevel): number {
  switch (level) {
    case "healthy":
      return 100;
    case "warning":
      return 70;
    case "critical":
      return 40;
    case "offline":
      return 10;
    default:
      return 50;
  }
}

export function levelFromScore(score: number): ProductionHealthLevel {
  if (score >= 85) return "healthy";
  if (score >= 65) return "warning";
  if (score >= 30) return "critical";
  if (score <= 0) return "offline";
  return "critical";
}

export function aggregateHealthScore(scores: number[]): number {
  if (scores.length === 0) return 50;
  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
}

export function aggregateHealthLevel(levels: ProductionHealthLevel[]): ProductionHealthLevel {
  if (levels.includes("offline")) return "offline";
  if (levels.includes("critical")) return "critical";
  if (levels.includes("warning")) return "warning";
  if (levels.every((level) => level === "healthy")) return "healthy";
  return "unknown";
}

export function badgeFromLevel(
  level: ProductionHealthLevel,
): { label: "Healthy" | "Needs Attention" | "Critical"; tone: "success" | "warning" | "critical" } {
  if (level === "healthy") {
    return { label: "Healthy", tone: "success" };
  }
  if (level === "warning" || level === "unknown") {
    return { label: "Needs Attention", tone: "warning" };
  }
  return { label: "Critical", tone: "critical" };
}

export function polarisToneFromLevel(level: ProductionHealthLevel): "success" | "warning" | "critical" | undefined {
  return badgeFromLevel(level).tone;
}

export function hoursSince(iso: string | null | undefined, reference = Date.now()): number | null {
  if (!iso) return null;
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return null;
  return Number(((reference - parsed) / (1000 * 60 * 60)).toFixed(2));
}

export function isStale(iso: string | null | undefined, thresholdHours = 24, reference = Date.now()): boolean {
  const hours = hoursSince(iso, reference);
  return hours === null || hours > thresholdHours;
}
