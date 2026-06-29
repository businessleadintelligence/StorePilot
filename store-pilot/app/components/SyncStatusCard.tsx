import type { OnboardingPhaseStatus } from "@prisma/client";

import type { SerializedStoreSyncStatus } from "../lib/sync-display";
import {
  formatLastSyncAt,
  getOnboardingStatusLabel,
  getOrdersBlockedCopy,
  getSyncCountLabel,
  getSyncStatusBadge,
} from "../lib/sync-display";

type SyncStatusCardProps = {
  syncStatus: SerializedStoreSyncStatus;
  phaseStatuses?: {
    products: OnboardingPhaseStatus | null;
    inventory: OnboardingPhaseStatus | null;
    orders: OnboardingPhaseStatus | null;
  };
};

type DomainConfig = {
  key: "products" | "inventory" | "orders";
  title: string;
  domain: SerializedStoreSyncStatus["products"] | SerializedStoreSyncStatus["orders"];
  phaseStatus: OnboardingPhaseStatus | null | undefined;
};

function getBadgeTone(
  badge: ReturnType<typeof getSyncStatusBadge>,
): "success" | "info" | "warning" | undefined {
  switch (badge) {
    case "Synced":
      return "success";
    case "Syncing":
      return "info";
    case "Blocked":
      return "warning";
    default:
      return undefined;
  }
}

export function SyncStatusCard({ syncStatus, phaseStatuses }: SyncStatusCardProps) {
  const domains: DomainConfig[] = [
    {
      key: "products",
      title: "Products",
      domain: syncStatus.products,
      phaseStatus: phaseStatuses?.products,
    },
    {
      key: "inventory",
      title: "Inventory",
      domain: syncStatus.inventory,
      phaseStatus: phaseStatuses?.inventory,
    },
    {
      key: "orders",
      title: "Orders",
      domain: syncStatus.orders,
      phaseStatus: phaseStatuses?.orders,
    },
  ];

  const ordersBlocked = syncStatus.orders.blocked;
  const blockedCopy = ordersBlocked ? getOrdersBlockedCopy() : null;
  const onboardingLabel = getOnboardingStatusLabel(syncStatus.onboardingStatus);

  return (
    <s-section heading="Sync Status">
      <s-box
        padding="base"
        background="base"
        borderWidth="small"
        borderColor="base"
        borderRadius="base"
      >
        <s-stack gap="base">
          <s-stack direction="inline" justifyContent="space-between" alignItems="center">
            <s-text color="subdued">Store setup</s-text>
            <s-badge tone={syncStatus.onboardingStatus === "completed" ? "success" : "info"}>
              {onboardingLabel}
            </s-badge>
          </s-stack>

          <s-grid
            gridTemplateColumns="@container (inline-size > 700px) repeat(3, 1fr), 1fr"
            gap="base"
          >
            {domains.map(({ key, title, domain, phaseStatus }) => {
              const badge = getSyncStatusBadge(phaseStatus, domain, key);
              const countLabel = getSyncCountLabel(domain, key, badge);
              const lastSyncLabel = formatLastSyncAt(domain.lastSyncAt);
              const showLastSync =
                Boolean(lastSyncLabel) && !(key === "orders" && ordersBlocked);

              return (
                <s-grid-item key={key}>
                  <s-box padding="base" background="subdued" borderRadius="base">
                    <s-stack gap="small-200">
                      <s-stack
                        direction="inline"
                        justifyContent="space-between"
                        alignItems="center"
                      >
                        <s-text type="strong">{title}</s-text>
                        <s-badge tone={getBadgeTone(badge)}>{badge}</s-badge>
                      </s-stack>
                      <s-text>{countLabel}</s-text>
                      {showLastSync ? (
                        <s-text color="subdued">Last sync: {lastSyncLabel}</s-text>
                      ) : null}
                    </s-stack>
                  </s-box>
                </s-grid-item>
              );
            })}
          </s-grid>

          {blockedCopy ? (
            <s-box padding="base" background="subdued" borderRadius="base">
              <s-stack gap="small-200">
                <s-text type="strong">{blockedCopy.heading}</s-text>
                <s-paragraph>{blockedCopy.primary}</s-paragraph>
                <s-paragraph color="subdued">{blockedCopy.secondary}</s-paragraph>
              </s-stack>
            </s-box>
          ) : null}
        </s-stack>
      </s-box>
    </s-section>
  );
}
