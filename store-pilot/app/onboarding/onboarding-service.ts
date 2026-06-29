import {
  buildOnboardingDashboard,
  onboardingDashboardPersistence,
  serializeOnboardingDashboardForLoader,
} from "./onboarding-dashboard";
import {
  buildOnboardingReminders,
  serializeOnboardingRemindersForLoader,
} from "./onboarding-recommendations";
import { getOrCreateMerchantOnboardingState, shouldRedirectToOnboarding } from "./onboarding-state";
import type { OnboardingDashboardData, OnboardingReminder } from "./onboarding-types";

const CACHE_TTL_MS = 15_000;
const dashboardCache = new Map<string, { expiresAt: number; dashboard: OnboardingDashboardData }>();
const reminderCache = new Map<string, { expiresAt: number; reminders: OnboardingReminder[] }>();

export async function getMerchantOnboardingDashboard(
  storeId: string,
  options: { forceRefresh?: boolean; persistence?: typeof onboardingDashboardPersistence } = {},
): Promise<OnboardingDashboardData> {
  const cached = dashboardCache.get(storeId);
  if (!options.forceRefresh && cached && Date.now() < cached.expiresAt) {
    return cached.dashboard;
  }

  const dashboard = await buildOnboardingDashboard({
    storeId,
    persistence: options.persistence ?? onboardingDashboardPersistence,
  });

  dashboardCache.set(storeId, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    dashboard,
  });

  return dashboard;
}

export async function getOnboardingReminders(storeId: string): Promise<OnboardingReminder[]> {
  const cached = reminderCache.get(storeId);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.reminders;
  }

  const record = await getOrCreateMerchantOnboardingState(storeId, onboardingDashboardPersistence);
  if (record.activated && !record.skippedStepIds.length) {
    return [];
  }

  const reminders = await buildOnboardingReminders(storeId);
  reminderCache.set(storeId, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    reminders,
  });
  return reminders;
}

export async function shouldShowOnboardingWizard(storeId: string): Promise<boolean> {
  const record = await getOrCreateMerchantOnboardingState(storeId, onboardingDashboardPersistence);
  return shouldRedirectToOnboarding(record);
}

export function serializeMerchantOnboardingForLoader(
  dashboard: OnboardingDashboardData,
): OnboardingDashboardData {
  return serializeOnboardingDashboardForLoader(dashboard);
}

export function serializeMerchantOnboardingRemindersForLoader(
  reminders: OnboardingReminder[],
): OnboardingReminder[] {
  return serializeOnboardingRemindersForLoader(reminders);
}

export function clearOnboardingServiceCache(storeId?: string): void {
  if (storeId) {
    dashboardCache.delete(storeId);
    reminderCache.delete(storeId);
    return;
  }
  dashboardCache.clear();
  reminderCache.clear();
}
