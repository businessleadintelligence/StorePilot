import type { JobStatus, OnboardingPhaseStatus } from "@prisma/client";

import type { SerializedStoreSyncStatus } from "../lib/sync-display";
import {
  formatLastSyncAt,
  getOnboardingStatusLabel,
  getOrdersBlockedCopy,
  getSyncCountLabel,
  getSyncStatusBadge,
} from "../lib/sync-display";
import { PremiumSection } from "./dashboard/PremiumSection";
import { IconSync, IconProducts, IconInventory, IconOrders } from "./dashboard/DashboardIcons";
import styles from "./dashboard/premium-dashboard.module.css";

type SyncStatusCardProps = {
  syncStatus: SerializedStoreSyncStatus;
  phaseStatuses?: {
    products: OnboardingPhaseStatus | null;
    inventory: OnboardingPhaseStatus | null;
    orders: OnboardingPhaseStatus | null;
  };
  currentJobStatus?: JobStatus | null;
  setupProgressPercent?: number;
};

type DomainConfig = {
  key: "products" | "inventory" | "orders";
  title: string;
  icon: React.ReactNode;
  domain: SerializedStoreSyncStatus["products"] | SerializedStoreSyncStatus["orders"];
  phaseStatus: OnboardingPhaseStatus | null | undefined;
  isActivePhase: boolean;
};

function getBadgeTone(
  badge: ReturnType<typeof getSyncStatusBadge>,
): "success" | "info" | "warning" | "critical" | undefined {
  switch (badge) {
    case "Synced":
      return "success";
    case "Syncing":
    case "Claimed":
    case "Queued":
      return "info";
    case "Blocked":
      return "warning";
    case "Failed":
    case "Cancelled":
      return "critical";
    default:
      return undefined;
  }
}

function syncProgress(badge: ReturnType<typeof getSyncStatusBadge>): number {
  switch (badge) {
    case "Synced":
      return 100;
    case "Syncing":
    case "Claimed":
      return 62;
    case "Queued":
      return 24;
    case "Blocked":
      return 28;
    case "Failed":
    case "Cancelled":
      return 8;
    default:
      return 12;
  }
}

export function SyncStatusCard({
  syncStatus,
  phaseStatuses,
  currentJobStatus,
  setupProgressPercent,
}: SyncStatusCardProps) {
  const activePhaseKey =
    phaseStatuses?.products === "queued" || phaseStatuses?.products === "running"
      ? "products"
      : phaseStatuses?.inventory === "queued" || phaseStatuses?.inventory === "running"
        ? "inventory"
        : phaseStatuses?.orders === "queued" || phaseStatuses?.orders === "running"
          ? "orders"
          : null;

  const domains: DomainConfig[] = [
    {
      key: "products",
      title: "Products",
      icon: <IconProducts size={18} />,
      domain: syncStatus.products,
      phaseStatus: phaseStatuses?.products,
      isActivePhase: activePhaseKey === "products",
    },
    {
      key: "inventory",
      title: "Inventory",
      icon: <IconInventory size={18} />,
      domain: syncStatus.inventory,
      phaseStatus: phaseStatuses?.inventory,
      isActivePhase: activePhaseKey === "inventory",
    },
    {
      key: "orders",
      title: "Orders",
      icon: <IconOrders size={18} />,
      domain: syncStatus.orders,
      phaseStatus: phaseStatuses?.orders,
      isActivePhase: activePhaseKey === "orders",
    },
  ];

  const ordersBlocked = syncStatus.orders.blocked;
  const blockedCopy = ordersBlocked ? getOrdersBlockedCopy() : null;
  const onboardingLabel = getOnboardingStatusLabel(syncStatus.onboardingStatus);
  const setupProgress =
    setupProgressPercent ??
    (syncStatus.onboardingStatus === "completed"
      ? 100
      : syncStatus.onboardingStatus === "running" ||
          syncStatus.onboardingStatus === "queued"
        ? 0
        : 0);

  return (
    <PremiumSection
      title="Sync Status"
      subtitle="Real-time pipeline health for your Shopify data"
      icon={<IconSync size={20} />}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className={styles.sectionSubtitle}>Store setup progress</span>
          <s-badge tone={syncStatus.onboardingStatus === "completed" ? "success" : "info"}>
            {onboardingLabel}
          </s-badge>
        </div>
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ width: `${setupProgress}%` }} />
        </div>

        <div className={styles.syncGrid}>
          {domains.map(({ key, title, icon, domain, phaseStatus, isActivePhase }) => {
            const badge = getSyncStatusBadge(
              phaseStatus,
              domain,
              key,
              isActivePhase ? currentJobStatus : null,
            );
            const countLabel = getSyncCountLabel(domain, key, badge);
            const lastSyncLabel = formatLastSyncAt(domain.lastSyncAt);
            const showLastSync =
              Boolean(lastSyncLabel) && !(key === "orders" && ordersBlocked);
            const progress = syncProgress(badge);

            return (
              <article key={key} className={styles.syncTile}>
                <div className={styles.metricTileTop}>
                  <span className={styles.metricIcon}>{icon}</span>
                  <s-badge tone={getBadgeTone(badge)}>{badge}</s-badge>
                </div>
                <strong>{title}</strong>
                <p className={styles.sectionSubtitle} style={{ margin: "6px 0 0" }}>
                  {countLabel}
                </p>
                {showLastSync ? (
                  <p className={styles.sectionSubtitle} style={{ margin: "4px 0 0" }}>
                    Last sync: {lastSyncLabel}
                  </p>
                ) : null}
                <div className={styles.progressTrack}>
                  <div
                    className={styles.progressFill}
                    style={{
                      width: `${progress}%`,
                      background:
                        badge === "Synced"
                          ? "linear-gradient(90deg, #008060, #5c6ac4)"
                          : undefined,
                    }}
                  />
                </div>
              </article>
            );
          })}
        </div>

        {blockedCopy ? (
          <div className={styles.listCard}>
            <strong>{blockedCopy.heading}</strong>
            <p className={styles.sectionSubtitle}>{blockedCopy.primary}</p>
            <p className={styles.sectionSubtitle}>{blockedCopy.secondary}</p>
          </div>
        ) : null}
      </div>
    </PremiumSection>
  );
}
