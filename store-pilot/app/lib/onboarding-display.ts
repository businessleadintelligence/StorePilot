import type { OnboardingPhaseStatus, OnboardingStatus } from "@prisma/client";

export type OnboardingPhaseKey = "products" | "inventory" | "orders";

export type OnboardingPhaseDisplay = {
  key: OnboardingPhaseKey;
  label: string;
  icon: "complete" | "in_progress" | "pending" | "blocked" | "failed";
};

export type OrdersBlockedDisplay = {
  heading: string;
  primary: string;
  secondary: string;
};

export type MerchantOnboardingLoaderData = {
  status: OnboardingStatus;
  progressPercent: number;
  progressLabel: string | null;
  productSyncStatus: OnboardingPhaseStatus;
  inventorySyncStatus: OnboardingPhaseStatus;
  ordersSyncStatus: OnboardingPhaseStatus;
  ordersBlockedDisplay: OrdersBlockedDisplay | null;
  startedAt: string | null;
  completedAt: string | null;
};

export type OnboardingStatusView = {
  status: OnboardingStatus;
  progressPercent: number;
  progressLabel: string | null;
  productSyncStatus: OnboardingPhaseStatus;
  inventorySyncStatus: OnboardingPhaseStatus;
  ordersSyncStatus: OnboardingPhaseStatus;
  blockedReason: string | null;
  blockedMessage: string | null;
  currentJobId: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
};

const PHASE_ORDER: OnboardingPhaseKey[] = ["products", "inventory", "orders"];

const PHASE_STATUS_FIELDS: Record<
  OnboardingPhaseKey,
  keyof Pick<
    OnboardingStatusView,
    "productSyncStatus" | "inventorySyncStatus" | "ordersSyncStatus"
  >
> = {
  products: "productSyncStatus",
  inventory: "inventorySyncStatus",
  orders: "ordersSyncStatus",
};

const PHASE_NAMES: Record<OnboardingPhaseKey, string> = {
  products: "Products",
  inventory: "Inventory",
  orders: "Orders",
};

export function getPhaseIcon(
  status: OnboardingPhaseStatus,
): OnboardingPhaseDisplay["icon"] {
  switch (status) {
    case "completed":
    case "skipped":
      return "complete";
    case "running":
    case "queued":
      return "in_progress";
    case "blocked":
      return "blocked";
    case "failed":
      return "failed";
    default:
      return "pending";
  }
}

export function getPhaseLabel(
  phase: OnboardingPhaseKey,
  status: OnboardingPhaseStatus,
): string {
  const name = PHASE_NAMES[phase];

  switch (status) {
    case "completed":
    case "skipped":
      return `${name} synced`;
    case "running":
    case "queued":
      return `${name} syncing`;
    case "blocked":
      return phase === "orders"
        ? "Waiting for Shopify order access approval"
        : `${name} blocked`;
    case "failed":
      return `${name} sync paused`;
    default:
      return `Waiting for ${name.toLowerCase()}`;
  }
}

export function getOnboardingPhaseDisplays(
  onboarding: OnboardingStatusView,
): OnboardingPhaseDisplay[] {
  return PHASE_ORDER.map((key) => {
    const status = onboarding[PHASE_STATUS_FIELDS[key]];

    return {
      key,
      label: getPhaseLabel(key, status),
      icon: getPhaseIcon(status),
    };
  });
}

export function getPhaseIconCharacter(
  icon: OnboardingPhaseDisplay["icon"],
): string {
  switch (icon) {
    case "complete":
      return "✓";
    case "in_progress":
      return "⏳";
    case "blocked":
    case "failed":
      return "!";
    default:
      return "○";
  }
}

export function shouldShowOnboardingCardFromLoader(
  onboarding: MerchantOnboardingLoaderData | null,
): boolean {
  return onboarding !== null && onboarding.status !== "completed";
}
