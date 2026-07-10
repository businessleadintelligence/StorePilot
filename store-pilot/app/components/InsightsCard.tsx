import type { StoreInsightsResult } from "../types/store-dashboard";
import { getInsightBadgeTone } from "../lib/display";
import { PremiumSection } from "./dashboard/PremiumSection";
import { IconInsights } from "./dashboard/DashboardIcons";
import styles from "./dashboard/premium-dashboard.module.css";

type InsightsCardProps = {
  insights: StoreInsightsResult;
};

export function InsightsCard({ insights }: InsightsCardProps) {
  return (
    <PremiumSection
      title="Operational Insights"
      subtitle="Signals detected from your synced store operations"
      icon={<IconInsights size={20} />}
    >
      {insights.insights.length > 0 ? (
        <div className={styles.insightList}>
          {insights.insights.map((item) => (
            <article key={item.id} className={styles.insightItem}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <s-badge tone={getInsightBadgeTone(item.severity)}>{item.severity}</s-badge>
                <strong>{item.title}</strong>
              </div>
              <p className={styles.sectionSubtitle} style={{ margin: 0 }}>
                {item.description}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>
            <IconInsights size={32} />
          </span>
          <strong>No operational insights</strong>
          <p className={styles.sectionSubtitle}>Your store operations look healthy.</p>
        </div>
      )}
    </PremiumSection>
  );
}
