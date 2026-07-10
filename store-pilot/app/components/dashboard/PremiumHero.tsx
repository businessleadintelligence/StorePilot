import styles from "./premium-dashboard.module.css";
import { IconHealth, IconPulse } from "./DashboardIcons";

type PremiumHeroProps = {
  storeName?: string;
  healthScore?: number | null;
  revenueLabel?: string | null;
  ordersLabel?: string | null;
  showOnboarding?: boolean;
};

export function PremiumHero({
  storeName = "StorePilot",
  healthScore,
  revenueLabel,
  ordersLabel,
  showOnboarding = false,
}: PremiumHeroProps) {
  return (
    <header className={styles.hero}>
      <div className={styles.heroGlow} aria-hidden="true" />
      <div className={styles.heroTop}>
        <div>
          <h1 className={styles.heroTitle}>{storeName} Intelligence</h1>
          <p className={styles.heroSubtitle}>
            Your premium operating command center — live metrics, intelligence workspaces,
            and prioritized actions in one interactive dashboard.
          </p>
        </div>
        <div className={styles.heroBadges}>
          <span className={styles.heroBadge}>
            <IconPulse size={16} />
            Live intelligence
          </span>
          <span className={styles.heroBadge}>
            <IconHealth size={16} />
            {showOnboarding ? "Syncing store" : "Analysis ready"}
          </span>
        </div>
      </div>
      <div className={styles.heroStats}>
        <div className={styles.metricTile}>
          <div className={styles.metricLabel}>Store health</div>
          <div className={styles.metricValue}>
            {healthScore != null ? `${healthScore}/100` : "—"}
          </div>
          <div className={styles.metricTrend}>Updated from synced data</div>
        </div>
        <div className={styles.metricTile}>
          <div className={styles.metricLabel}>Revenue</div>
          <div className={styles.metricValue}>{revenueLabel ?? "—"}</div>
          <div className={styles.metricTrend}>Gross revenue snapshot</div>
        </div>
        <div className={styles.metricTile}>
          <div className={styles.metricLabel}>Orders</div>
          <div className={styles.metricValue}>{ordersLabel ?? "—"}</div>
          <div className={styles.metricTrend}>Synced order volume</div>
        </div>
      </div>
    </header>
  );
}
