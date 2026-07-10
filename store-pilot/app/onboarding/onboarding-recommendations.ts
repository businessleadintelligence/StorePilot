import { buildConnectorDataQualityWarnings } from "../connectors/core/data-quality-warnings";
import type { ConnectorId } from "../connectors/core/connector.types";
import { getClarityIntegrationPublicView } from "../services/clarity-integration.server";
import { getGoogleIntegrationPublicView } from "../services/google-integration.server";
import { getCachedProductionBadge } from "../production/production-service";
import type { OnboardingReminder } from "./onboarding-types";

export async function buildOnboardingReminders(storeId: string): Promise<OnboardingReminder[]> {
  const [google, clarity] = await Promise.all([
    getGoogleIntegrationPublicView(storeId),
    getClarityIntegrationPublicView(storeId),
  ]);
  const healthBadge = getCachedProductionBadge(storeId);

  const presentConnectorIds: ConnectorId[] = [];
  if (google.connected && google.lastSyncAt) presentConnectorIds.push("ga4");
  if (google.searchConsoleSiteUrl && google.searchConsoleLastSyncAt) presentConnectorIds.push("gsc");
  if (google.pageSpeedAvailable && google.pageSpeedLastSyncAt) presentConnectorIds.push("pagespeed");
  if (clarity.connected && clarity.lastSyncAt) presentConnectorIds.push("clarity");

  const warnings = buildConnectorDataQualityWarnings({
    presentConnectorIds,
    googleAnalyticsSkipped: Boolean(google.googleAnalyticsSkipped),
  });

  const reminders: OnboardingReminder[] = warnings.map((warning) => ({
    id: `onboarding-reminder:${warning.code}`,
    severity: warning.connectorId === "ga4" ? "warning" : "info",
    message: formatReminderMessage(warning.message, warning.impacts[0] ?? null),
    href: warning.connectorId === "clarity" ? "/app/settings" : "/app/onboarding",
    connectorId: warning.connectorId,
  }));

  if (healthBadge.label === "Critical") {
    reminders.unshift({
      id: "onboarding-reminder:system-health-critical",
      severity: "warning",
      message: "System health requires attention before relying on automation recommendations.",
      href: "/app/system-health",
      connectorId: null,
    });
  }

  return dedupeReminders(reminders).slice(0, 5);
}

function formatReminderMessage(message: string, impact: string | null): string {
  if (!impact) return message;
  if (message.includes(impact)) return message;
  return `${message} ${impact}.`;
}

function dedupeReminders(reminders: OnboardingReminder[]): OnboardingReminder[] {
  const seen = new Set<string>();
  return reminders.filter((reminder) => {
    if (seen.has(reminder.id)) return false;
    seen.add(reminder.id);
    return true;
  });
}

export function serializeOnboardingRemindersForLoader(
  reminders: OnboardingReminder[],
): OnboardingReminder[] {
  return JSON.parse(JSON.stringify(reminders)) as OnboardingReminder[];
}
