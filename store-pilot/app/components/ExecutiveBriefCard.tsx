import type { ExecutiveBrief } from "../types/store-dashboard";
import { PremiumSection } from "./dashboard/PremiumSection";
import { IconExecutive } from "./dashboard/DashboardIcons";
import styles from "./dashboard/premium-dashboard.module.css";

type ExecutiveBriefCardProps = {
  brief: ExecutiveBrief;
};

export function ExecutiveBriefCard({ brief }: ExecutiveBriefCardProps) {
  return (
    <PremiumSection
      title="Executive Brief"
      subtitle="Daily summary of performance, risks, and focus areas"
      icon={<IconExecutive size={20} />}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className={styles.listCard}>
          <strong style={{ fontSize: "1.05rem" }}>{brief.headline}</strong>
          <p className={styles.sectionSubtitle} style={{ margin: "8px 0 0" }}>
            {brief.summary}
          </p>
        </div>

        {brief.highlights.length > 0 ? (
          <div>
            <strong>Highlights</strong>
            <div className={styles.insightList} style={{ marginTop: 10 }}>
              {brief.highlights.map((highlight) => (
                <div key={highlight} className={styles.insightItem}>
                  <span style={{ color: "#008060", marginRight: 8 }}>✓</span>
                  {highlight}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {brief.concerns.length > 0 ? (
          <div>
            <strong>Concerns</strong>
            <div className={styles.insightList} style={{ marginTop: 10 }}>
              {brief.concerns.map((concern) => (
                <div key={concern} className={styles.insightItem}>
                  <span style={{ color: "#f49342", marginRight: 8 }}>!</span>
                  {concern}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </PremiumSection>
  );
}
