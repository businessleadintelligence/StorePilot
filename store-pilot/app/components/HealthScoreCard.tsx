import type { StoreHealthScore } from "../types/store-dashboard";
import { getGradeBadgeTone } from "../lib/display";
import { PremiumSection } from "./dashboard/PremiumSection";
import { ProgressRing } from "./dashboard/ProgressRing";
import { IconHealth } from "./dashboard/DashboardIcons";
import styles from "./dashboard/premium-dashboard.module.css";

type HealthScoreCardProps = {
  healthScore: StoreHealthScore;
};

function scoreColor(score: number): string {
  if (score >= 80) return "#008060";
  if (score >= 60) return "#f49342";
  return "#d82c0d";
}

function BreakdownBar({
  label,
  score,
  max,
}: {
  label: string;
  score: number;
  max: number;
}) {
  const pct = Math.round((score / max) * 100);
  return (
    <div className={styles.breakdownRow}>
      <span className={styles.breakdownLabel}>{label}</span>
      <div className={styles.progressTrack}>
        <div
          className={styles.progressFill}
          style={{ width: `${pct}%`, background: scoreColor(pct) }}
        />
      </div>
      <span className={styles.breakdownValue}>
        {score}/{max}
      </span>
    </div>
  );
}

export function HealthScoreCard({ healthScore }: HealthScoreCardProps) {
  return (
    <PremiumSection
      title="Store Health Score"
      subtitle="Operational readiness across products, inventory, and orders"
      icon={<IconHealth size={20} />}
    >
      <div className={styles.healthLayout}>
        <ProgressRing
          value={healthScore.score}
          label={`Grade ${healthScore.grade}`}
          color={scoreColor(healthScore.score)}
        />
        <div className={styles.healthBreakdown}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong>Health breakdown</strong>
            <s-badge tone={getGradeBadgeTone(healthScore.grade)}>
              Grade {healthScore.grade}
            </s-badge>
          </div>
          <BreakdownBar label="Products" score={healthScore.productsScore} max={30} />
          <BreakdownBar label="Inventory" score={healthScore.inventoryScore} max={30} />
          <BreakdownBar label="Orders" score={healthScore.ordersScore} max={40} />
          {healthScore.issues.length > 0 ? (
            <div className={styles.insightList}>
              {healthScore.issues.map((issue) => (
                <div key={issue} className={styles.listCard}>
                  <s-text>{issue}</s-text>
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.sectionSubtitle}>
              No operational issues detected from synced store data.
            </p>
          )}
        </div>
      </div>
    </PremiumSection>
  );
}
