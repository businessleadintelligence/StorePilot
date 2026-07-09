import type { BillingLimitCheckResult, BillingNotification, BillingTrialStatus , BillingPlanDefinition } from "./billing-types";
import { resolveUpgradeTarget } from "./billing-limits";

export function buildBillingNotifications(input: {
  trial: BillingTrialStatus;
  usageChecks: Record<string, BillingLimitCheckResult>;
  commercialStatus: string;
  currentPlan: BillingPlanDefinition;
}): BillingNotification[] {
  const notifications: BillingNotification[] = [];

  if (input.trial.upgradePrompt && input.trial.remainingDays <= 3 && !input.trial.expired) {
    notifications.push({
      id: "billing:trial-ending",
      severity: "warning",
      title: "Trial ending soon",
      message: input.trial.upgradePrompt,
      actionLabel: "View plans",
      actionHref: "/app/billing",
    });
  }

  if (input.trial.expired) {
    notifications.push({
      id: "billing:trial-expired",
      severity: "critical",
      title: "Trial expired",
      message: "Select a plan to restore StorePilot access.",
      actionLabel: "Upgrade now",
      actionHref: "/app/billing",
    });
  }

  if (input.commercialStatus === "past_due") {
    notifications.push({
      id: "billing:payment-failed",
      severity: "critical",
      title: "Payment failed",
      message: "Update your Shopify billing approval to restore service.",
      actionLabel: "Manage billing",
      actionHref: "/app/billing",
    });
  }

  if (input.commercialStatus === "cancelled") {
    notifications.push({
      id: "billing:subscription-cancelled",
      severity: "warning",
      title: "Subscription cancelled",
      message: "Your StorePilot subscription is no longer active.",
      actionLabel: "Reactivate",
      actionHref: "/app/billing",
    });
  }

  for (const check of Object.values(input.usageChecks)) {
    if (check.limit <= 0) continue;
    const ratio = check.used / check.limit;
    if (ratio >= 1) {
      notifications.push({
        id: `billing:limit:${check.action}`,
        severity: "critical",
        title: "Plan limit reached",
        message: check.upgradeMessage ?? "Upgrade your plan to continue.",
        actionLabel: "Upgrade",
        actionHref: "/app/billing",
      });
    } else if (ratio >= 0.8) {
      notifications.push({
        id: `billing:usage-80:${check.action}`,
        severity: "warning",
        title: "Usage at 80%",
        message: `${check.action.replace(/_/g, " ")} is at ${Math.round(ratio * 100)}% of your plan limit.`,
        actionLabel: "View usage",
        actionHref: "/app/billing",
      });
    }
  }

  const upgradeTarget = resolveUpgradeTarget(input.currentPlan.slug);
  if (upgradeTarget && input.currentPlan.slug === "starter") {
    notifications.push({
      id: "billing:upgrade-recommended",
      severity: "info",
      title: "Upgrade recommended",
      message: "Growth unlocks full AI, all connectors, Operations, and Automation.",
      actionLabel: "Compare plans",
      actionHref: "/app/billing",
    });
  }

  return dedupeNotifications(notifications).slice(0, 8);
}

function dedupeNotifications(items: BillingNotification[]): BillingNotification[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}
