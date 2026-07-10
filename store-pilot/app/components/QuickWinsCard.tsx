import type { QuickWinUiSummary } from "../services/quick-wins-ui.server";
import { PremiumSection } from "./dashboard/PremiumSection";
import { MiniSparkline } from "./dashboard/MiniSparkline";
import { IconSpark, IconRevenue } from "./dashboard/DashboardIcons";
import styles from "./dashboard/premium-dashboard.module.css";

type QuickWinsCardProps = {
  quickWins: QuickWinUiSummary;
  currency: string;
};

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function QuickWinsCard({ quickWins, currency }: QuickWinsCardProps) {
  const sparkValues = quickWins.items.slice(0, 7).map((item) => item.revenueOpportunity);

  return (
    <PremiumSection
      title="Quick Wins"
      subtitle="Ranked revenue opportunities discovered from your store data"
      icon={<IconSpark size={20} />}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div className={styles.metricGrid}>
          <article className={styles.metricTile}>
            <div className={styles.metricTileTop}>
              <span className={styles.metricIcon}>
                <IconRevenue size={18} />
              </span>
              <MiniSparkline
                values={sparkValues.length > 0 ? sparkValues : [1, 2, 3, 4, 5, 6, 7]}
                color="#008060"
                ariaLabel="Revenue opportunity trend"
              />
            </div>
            <div className={styles.metricLabel}>Estimated opportunity</div>
            <div className={styles.metricValue}>
              {formatCurrency(quickWins.estimatedRevenueOpportunity, currency)}
              <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>/mo</span>
            </div>
            <div className={styles.metricTrend}>{quickWins.totalWins} opportunities ranked</div>
          </article>
          <article className={styles.metricTile}>
            <div className={styles.metricLabel}>Discovery headline</div>
            <strong style={{ display: "block", marginTop: 8 }}>{quickWins.headline}</strong>
            <div className={styles.insightList} style={{ marginTop: 12 }}>
              {quickWins.highlights.map((highlight) => (
                <div key={highlight.label} className={styles.listCard}>
                  <span style={{ color: "#008060", marginRight: 8 }}>✓</span>
                  {highlight.label}
                </div>
              ))}
            </div>
          </article>
        </div>

        {quickWins.items.length > 0 ? (
          <div>
            <strong>Top opportunities</strong>
            <div className={styles.recommendationList} style={{ marginTop: 12 }}>
              {quickWins.items.slice(0, 6).map((item) => (
                <article key={item.winType} className={styles.recommendationItem}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 8,
                    }}
                  >
                    <strong>{item.title}</strong>
                    <s-badge>{item.category}</s-badge>
                  </div>
                  <p className={styles.sectionSubtitle} style={{ margin: "0 0 8px" }}>
                    {item.description}
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                    <span className={styles.metricTrend}>Impact: {item.businessImpact}</span>
                    <span className={styles.metricTrend}>
                      Confidence: {item.confidencePercent}%
                    </span>
                    <span className={styles.metricTrend}>
                      Revenue: {formatCurrency(item.revenueOpportunity, currency)}/mo
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </PremiumSection>
  );
}
