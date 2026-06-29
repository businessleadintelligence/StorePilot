import type {
  OnboardingPhaseStatus,
  OnboardingStatus,
} from "@prisma/client";

import prisma from "../db.server";

export type OnboardingStatusResponse = {
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

const PHASE_ORDER: OnboardingPhaseKey[] = ["products", "inventory", "orders"];

const PHASE_STATUS_FIELDS: Record<
  OnboardingPhaseKey,
  keyof Pick<
    OnboardingStatusResponse,
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

const DEFAULT_ORDERS_BLOCKED_COPY: OrdersBlockedDisplay = {
  heading: "Orders Sync Waiting",
  primary: "StorePilot is waiting for Shopify order-access approval.",
  secondary:
    "Products and inventory are already synced. No action required.",
};

const BLOCKED_REASON_COPY: Record<string, OrdersBlockedDisplay> = {
  access_denied: DEFAULT_ORDERS_BLOCKED_COPY,
  insufficient_scope: DEFAULT_ORDERS_BLOCKED_COPY,
  protected_customer_data: {
    heading: "Orders Sync Waiting",
    primary:
      "StorePilot is waiting for Shopify order data access approval.",
    secondary:
      "Products and inventory are already synced. No action required.",
  },
};

const INTERNAL_MESSAGE_PATTERNS = [
  /graphql/i,
  /stack/i,
  /worker/i,
  /payload/i,
  /prisma/i,
  /exception/i,
  / at /,
  /\berror:\b/i,
];

export async function getOnboardingStatus(
  storeId: string,
): Promise<OnboardingStatusResponse | null> {
  const onboarding = await prisma.storeOnboarding.findUnique({
    where: { storeId },
    select: {
      status: true,
      progressPercent: true,
      progressLabel: true,
      productSyncStatus: true,
      inventorySyncStatus: true,
      ordersSyncStatus: true,
      blockedReason: true,
      blockedMessage: true,
      currentJobId: true,
      startedAt: true,
      completedAt: true,
    },
  });

  if (!onboarding) {
    return null;
  }

  return onboarding;
}

export function shouldShowOnboardingCard(
  onboarding: OnboardingStatusResponse | null,
): boolean {
  return onboarding !== null && onboarding.status !== "completed";
}

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
  onboarding: OnboardingStatusResponse,
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

export function isOrdersSyncBlocked(
  onboarding: OnboardingStatusResponse,
): boolean {
  return onboarding.ordersSyncStatus === "blocked";
}

export function isMerchantSafeMessage(message: string): boolean {
  const trimmed = message.trim();

  if (!trimmed) {
    return false;
  }

  return !INTERNAL_MESSAGE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function getOrdersBlockedDisplay(
  onboarding: OnboardingStatusResponse,
): OrdersBlockedDisplay {
  const mappedCopy =
    (onboarding.blockedReason &&
      BLOCKED_REASON_COPY[onboarding.blockedReason]) ||
    DEFAULT_ORDERS_BLOCKED_COPY;

  const primary =
    onboarding.blockedMessage &&
    isMerchantSafeMessage(onboarding.blockedMessage)
      ? onboarding.blockedMessage
      : mappedCopy.primary;

  return {
    heading: mappedCopy.heading,
    primary,
    secondary: mappedCopy.secondary,
  };
}

export function serializeOnboardingForLoader(
  onboarding: OnboardingStatusResponse | null,
): MerchantOnboardingLoaderData | null {
  if (!onboarding) {
    return null;
  }

  return {
    status: onboarding.status,
    progressPercent: onboarding.progressPercent,
    progressLabel: onboarding.progressLabel,
    productSyncStatus: onboarding.productSyncStatus,
    inventorySyncStatus: onboarding.inventorySyncStatus,
    ordersSyncStatus: onboarding.ordersSyncStatus,
    ordersBlockedDisplay: isOrdersSyncBlocked(onboarding)
      ? getOrdersBlockedDisplay(onboarding)
      : null,
    startedAt: onboarding.startedAt?.toISOString() ?? null,
    completedAt: onboarding.completedAt?.toISOString() ?? null,
  };
}

export function shouldShowOnboardingCardFromLoader(
  onboarding: MerchantOnboardingLoaderData | null,
): boolean {
  return onboarding !== null && onboarding.status !== "completed";
}

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

export type SerializedOnboardingStatus = MerchantOnboardingLoaderData;

export function deserializeOnboardingFromLoader(
  onboarding: MerchantOnboardingLoaderData | null,
): OnboardingStatusResponse | null {
  if (!onboarding) {
    return null;
  }

  return {
    status: onboarding.status,
    progressPercent: onboarding.progressPercent,
    progressLabel: onboarding.progressLabel,
    productSyncStatus: onboarding.productSyncStatus,
    inventorySyncStatus: onboarding.inventorySyncStatus,
    ordersSyncStatus: onboarding.ordersSyncStatus,
    blockedReason: onboarding.ordersBlockedDisplay ? "access_denied" : null,
    blockedMessage: onboarding.ordersBlockedDisplay?.primary ?? null,
    currentJobId: null,
    startedAt: onboarding.startedAt ? new Date(onboarding.startedAt) : null,
    completedAt: onboarding.completedAt
      ? new Date(onboarding.completedAt)
      : null,
  };
}
