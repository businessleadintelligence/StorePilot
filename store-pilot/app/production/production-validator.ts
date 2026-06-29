import type { ProductionDashboardData, ProductionHealthSnapshot } from "./production-types";
import { validateProductionEnvironment } from "./production-security";

const PII_PATTERNS = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/,
  /customer@/i,
  /visitor[_-]?id/i,
  /session[_-]?recording/i,
];

export function validateProductionSnapshot(snapshot: ProductionHealthSnapshot): {
  ok: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!snapshot.storeId.trim()) {
    errors.push("storeId is required");
  }

  if (snapshot.subsystems.length === 0) {
    errors.push("snapshot must include subsystem health");
  }

  if (snapshot.overallHealthScore < 0 || snapshot.overallHealthScore > 100) {
    errors.push("overallHealthScore must be between 0 and 100");
  }

  if (snapshot.dataQuality.score < 0 || snapshot.dataQuality.score > 100) {
    errors.push("dataQuality.score must be between 0 and 100");
  }

  for (const alert of snapshot.alerts) {
    if (!alert.title.trim()) {
      errors.push(`alert ${alert.id} missing title`);
    }
  }

  const serialized = JSON.stringify(snapshot);
  for (const pattern of PII_PATTERNS) {
    if (pattern.test(serialized)) {
      errors.push("snapshot contains disallowed PII-like content");
      break;
    }
  }

  return { ok: errors.length === 0, errors };
}

export function validateProductionDashboard(dashboard: ProductionDashboardData): {
  ok: boolean;
  errors: string[];
} {
  const snapshotValidation = validateProductionSnapshot(dashboard);
  const errors = [...snapshotValidation.errors];

  if (!dashboard.sections.connectors.length) {
    errors.push("dashboard missing connector section");
  }

  if (!dashboard.settingsBadge.label) {
    errors.push("dashboard missing settings badge");
  }

  return { ok: errors.length === 0, errors };
}

export function validateProductionRuntime(): { ok: boolean; missing: string[] } {
  return validateProductionEnvironment();
}
