import type { OnboardingPhaseStatus, OnboardingStatus } from "@prisma/client";

export type SyncDomainStatus = {
  synced: boolean;
  count: number;
  lastSyncAt: string | null;
};

export type OrdersSyncDomainStatus = SyncDomainStatus & {
  blocked: boolean;
  blockedReason: string | null;
};

export type SyncStatusBadge = "Synced" | "Syncing" | "Blocked" | "Not Started";

export type SyncStatusDomainKey = "products" | "inventory" | "orders";

export type SerializedStoreSyncStatus = {
  onboardingStatus: OnboardingStatus | null;
  products: SyncDomainStatus;
  inventory: SyncDomainStatus;
  orders: OrdersSyncDomainStatus;
};

function isPhaseSyncing(
  phaseStatus: OnboardingPhaseStatus | null | undefined,
): boolean {
  return phaseStatus === "running" || phaseStatus === "queued";
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
