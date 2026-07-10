import type { StoreRecommendationsResult } from "../types/store-dashboard";
import { getRecommendationBadgeTone } from "../lib/display";
import { PremiumSection } from "./dashboard/PremiumSection";
import { IconSpark } from "./dashboard/DashboardIcons";
import styles from "./dashboard/premium-dashboard.module.css";

type RecommendationsCardProps = {
  recommendations: StoreRecommendationsResult;
};

export function RecommendationsCard({ recommendations }: RecommendationsCardProps) {
  return (
    <PremiumSection
      title="Recommendations"
      subtitle="Prioritized actions to improve store performance"
      icon={<IconSpark size={20} />}
      href="/app/recommendations"
      linkLabel="View all"
    >
      {recommendations.recommendations.length > 0 ? (
        <div className={styles.recommendationList}>
          {recommendations.recommendations.map((item) => (
            <article key={item.id} className={styles.recommendationItem}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <s-badge tone={getRecommendationBadgeTone(item.severity)}>
                  {item.severity}
                </s-badge>
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
            <IconSpark size={32} />
          </span>
          <strong>No issues detected</strong>
          <p className={styles.sectionSubtitle}>Store operations look healthy.</p>
        </div>
      )}
    </PremiumSection>
  );
}
