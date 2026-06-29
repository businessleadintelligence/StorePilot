import type { ExecutiveRecommendationView } from "../../services/executive-dashboard.types";
import { formatCurrency } from "../../lib/format";
import { ExecutiveChart } from "./ExecutiveChart";
import styles from "./executive-dashboard.module.css";

type ProductDetailDrawerProps = {
  recommendation: ExecutiveRecommendationView | null;
  currency: string;
  onClose: () => void;
};

export function ProductDetailDrawer({
  recommendation,
  currency,
  onClose,
}: ProductDetailDrawerProps) {
  if (!recommendation) {
    return null;
  }

  const impactTotal =
    (recommendation.estimatedImpact.revenueRecovered ?? 0) +
    (recommendation.estimatedImpact.revenueOpportunity ?? 0) +
    (recommendation.estimatedImpact.estimatedLostSales ?? 0);

  return (
    <>
      <button
        type="button"
        className={styles.drawerOverlay}
        aria-label="Close recommendation details"
        onClick={onClose}
      />
      <aside
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-label={`Recommendation details for ${recommendation.title}`}
      >
        <div className={styles.drawerHeader}>
          <div>
            <div className={styles.cardLabel}>{recommendation.group}</div>
            <h2 className={styles.sectionTitle}>{recommendation.title}</h2>
          </div>
          <button type="button" className={styles.button} onClick={onClose}>
            Close
          </button>
        </div>

        <div className={styles.card}>
          <div className={styles.cardLabel}>Executive summary</div>
          <p>{recommendation.reason}</p>
          <p className={styles.cardMeta}>{recommendation.expectedResult}</p>
        </div>

        <div className={styles.card}>
          <div className={styles.cardLabel}>Evidence</div>
          <ul className={styles.evidenceList}>
            {recommendation.evidence.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <ExecutiveChart
          title="Estimated impact profile"
          points={[
            {
              label: "Recovered",
              value: recommendation.estimatedImpact.revenueRecovered ?? 0,
            },
            {
              label: "Opportunity",
              value: recommendation.estimatedImpact.revenueOpportunity ?? 0,
            },
            {
              label: "Lost sales",
              value: recommendation.estimatedImpact.estimatedLostSales ?? 0,
            },
          ]}
          ariaLabel="Estimated impact chart"
          variant="bar"
          formatValue={(value) => formatCurrency(value, currency)}
        />

        <div className={styles.card}>
          <div className={styles.cardLabel}>Health explanation</div>
          <p className={styles.cardMeta}>
            {recommendation.businessImpact || "Health explanation is included in the persisted Product Intelligence payload."}
          </p>
        </div>

        <div className={styles.card}>
          <div className={styles.cardLabel}>Timeline</div>
          <ul className={styles.actionList}>
            {Object.entries(recommendation.timeline)
              .filter(([, value]) => value)
              .map(([key, value]) => (
                <li key={key}>
                  {key}: {value}
                </li>
              ))}
          </ul>
        </div>

        <div className={styles.card}>
          <div className={styles.cardLabel}>Potential risk</div>
          <p>{recommendation.potentialRisk || "No additional risk noted."}</p>
          <div className={styles.cardMeta}>
            Estimated time: {recommendation.estimatedTime || "Not specified"} · Impact:{" "}
            {impactTotal > 0 ? formatCurrency(impactTotal, currency) : recommendation.businessImpact}
          </div>
        </div>
      </aside>
    </>
  );
}
