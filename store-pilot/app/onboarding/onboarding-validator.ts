import type { OnboardingDashboardData, OnboardingReminder } from "./onboarding-types";

const PII_PATTERNS = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/,
  /visitor[_-]?id/i,
];

export function validateOnboardingDashboard(dashboard: OnboardingDashboardData): {
  ok: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!dashboard.storeId.trim()) {
    errors.push("storeId is required");
  }

  if (dashboard.progress.completionPercent < 0 || dashboard.progress.completionPercent > 100) {
    errors.push("completionPercent out of range");
  }

  if (dashboard.activationScore.score < 0 || dashboard.activationScore.score > 100) {
    errors.push("activationScore out of range");
  }

  if (dashboard.steps.length === 0) {
    errors.push("steps are required");
  }

  const serialized = JSON.stringify(dashboard);
  for (const pattern of PII_PATTERNS) {
    if (pattern.test(serialized)) {
      errors.push("dashboard contains disallowed PII-like content");
      break;
    }
  }

  return { ok: errors.length === 0, errors };
}

export function validateOnboardingReminders(reminders: OnboardingReminder[]): {
  ok: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  for (const reminder of reminders) {
    if (!reminder.message.trim()) {
      errors.push(`reminder ${reminder.id} missing message`);
    }
    if (!reminder.href.startsWith("/app")) {
      errors.push(`reminder ${reminder.id} must link to an app route`);
    }
  }

  return { ok: errors.length === 0, errors };
}

export function validateOnboardingStepNavigation(stepId: string, skippable: boolean, intent: string): {
  ok: boolean;
  error: string | null;
} {
  if (intent === "skip-step" && !skippable) {
    return { ok: false, error: "step_not_skippable" };
  }

  if (!stepId.trim()) {
    return { ok: false, error: "missing_step" };
  }

  return { ok: true, error: null };
}
