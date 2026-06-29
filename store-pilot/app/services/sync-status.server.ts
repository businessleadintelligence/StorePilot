import type { OnboardingPhaseStatus, OnboardingStatus } from "@prisma/client";

import prisma from "../db.server";

export type SyncDomainStatus = {
  synced: boolean;
  count: number;
  lastSyncAt: string | null;
};

export type OrdersSyncDomainStatus = SyncDomainStatus & {
  blocked: boolean;
  blockedReason: string | null;
};

export type StoreSyncStatus = {
  onboardingStatus: OnboardingStatus | null;
  products: SyncDomainStatus;
  inventory: SyncDomainStatus;
  orders: OrdersSyncDomainStatus;
};

export type SyncStatusBadge = "Synced" | "Syncing" | "Blocked" | "Not Started";

export type SyncStatusDomainKey = "products" | "inventory" | "orders";

const MERCHANT_BLOCKED_REASONS: Record<string, string> = {
  access_denied: "order_access_pending",
  insufficient_scope: "order_scope_pending",
  protected_customer_data: "order_data_access_pending",
};

function serializeDate(date: Date | null | undefined): string | null {
  return date?.toISOString() ?? null;
}

function isPhaseSynced(
  phaseStatus: OnboardingPhaseStatus | null | undefined,
  lastSyncAt: Date | null | undefined,
  count: number,
): boolean {
  if (phaseStatus === "completed" || phaseStatus === "skipped") {
    return true;
  }

  return Boolean(lastSyncAt) && count > 0;
}

function isPhaseSyncing(
  phaseStatus: OnboardingPhaseStatus | null | undefined,
): boolean {
  return phaseStatus === "running" || phaseStatus === "queued";
}

export function toMerchantBlockedReason(
  blockedReason: string | null | undefined,
): string | null {
  if (!blockedReason) {
    return null;
  }

  return MERCHANT_BLOCKED_REASONS[blockedReason] ?? "order_access_pending";
}

export function getSyncStatusBadge(
  phaseStatus: OnboardingPhaseStatus | null | undefined,
  domain: SyncDomainStatus | OrdersSyncDomainStatus,
  domainKey: SyncStatusDomainKey,
): SyncStatusBadge {
  if (domainKey === "orders" && "blocked" in domain && domain.blocked) {
    return "Blocked";
  }

  if (isPhaseSyncing(phaseStatus)) {
    return "Syncing";
  }

  if (domain.synced) {
    return "Synced";
  }

  return "Not Started";
}

export function formatLastSyncAt(lastSyncAt: string | null): string | null {
  if (!lastSyncAt) {
    return null;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(lastSyncAt));
}

export function getSyncCountLabel(
  domain: SyncDomainStatus | OrdersSyncDomainStatus,
  domainKey: SyncStatusDomainKey,
  badge: SyncStatusBadge,
): string {
  if (domainKey === "orders" && "blocked" in domain && domain.blocked) {
    return "Waiting for Shopify approval";
  }

  if (badge === "Not Started") {
    return "Not synced yet";
  }

  if (domain.count === 1) {
    return "1 synced";
  }

  if (domain.count > 0) {
    return `${domain.count} synced`;
  }

  if (badge === "Synced") {
    return "Synced";
  }

  return "Sync in progress";
}

export function getOrdersBlockedCopy(): {
  heading: string;
  primary: string;
  secondary: string;
} {
  return {
    heading: "Orders Sync Waiting",
    primary: "StorePilot is waiting for Shopify order access approval.",
    secondary: "Products and inventory are working normally.",
  };
}

export async function getStoreSyncStatus(
  storeId: string,
): Promise<StoreSyncStatus> {
  const [store, onboarding, productCount, orderCount] = await Promise.all([
    prisma.store.findUnique({
      where: { id: storeId },
      select: {
        lastProductsSyncAt: true,
        lastInventorySyncAt: true,
        lastOrdersSyncAt: true,
      },
    }),
    prisma.storeOnboarding.findUnique({
      where: { storeId },
      select: {
        status: true,
        productSyncStatus: true,
        inventorySyncStatus: true,
        ordersSyncStatus: true,
        blockedReason: true,
      },
    }),
    prisma.product.count({
      where: {
        storeId,
        status: { not: "archived" },
      },
    }),
    prisma.order.count({
      where: { storeId },
    }),
  ]);

  const ordersBlocked = onboarding?.ordersSyncStatus === "blocked";

  return {
    onboardingStatus: onboarding?.status ?? null,
    products: {
      synced: isPhaseSynced(
        onboarding?.productSyncStatus,
        store?.lastProductsSyncAt,
        productCount,
      ),
      count: productCount,
      lastSyncAt: serializeDate(store?.lastProductsSyncAt),
    },
    inventory: {
      synced: isPhaseSynced(
        onboarding?.inventorySyncStatus,
        store?.lastInventorySyncAt,
        productCount,
      ),
      count: productCount,
      lastSyncAt: serializeDate(store?.lastInventorySyncAt),
    },
    orders: {
      synced: isPhaseSynced(
        onboarding?.ordersSyncStatus,
        store?.lastOrdersSyncAt,
        orderCount,
      ),
      count: orderCount,
      lastSyncAt: serializeDate(store?.lastOrdersSyncAt),
      blocked: ordersBlocked,
      blockedReason: ordersBlocked
        ? toMerchantBlockedReason(onboarding?.blockedReason)
        : null,
    },
  };
}

export type SerializedStoreSyncStatus = StoreSyncStatus;

export function serializeStoreSyncStatusForLoader(
  syncStatus: StoreSyncStatus,
): SerializedStoreSyncStatus {
  return syncStatus;
}

export function getOnboardingStatusLabel(
  onboardingStatus: OnboardingStatus | null,
): string {
  switch (onboardingStatus) {
    case "completed":
      return "Complete";
    case "running":
    case "queued":
      return "In progress";
    case "failed":
      return "Needs attention";
    case "not_started":
      return "Not started";
    default:
      return "Unknown";
  }
}
