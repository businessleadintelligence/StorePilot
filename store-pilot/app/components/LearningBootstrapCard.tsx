import type { LearningReadinessUiData } from "../services/learning-ui.server";
import { PremiumSection } from "./dashboard/PremiumSection";
import { ProgressRing } from "./dashboard/ProgressRing";
import { IconMemory, IconSync } from "./dashboard/DashboardIcons";
import styles from "./dashboard/premium-dashboard.module.css";

type LearningBootstrapCardProps = {
  learning: LearningReadinessUiData;
};

function stepIcon(status: "pending" | "running" | "complete"): string {
  switch (status) {
    case "complete":
      return "✓";
    case "running":
      return "…";
    default:
      return "○";
  }
}

export function LearningBootstrapCard({ learning }: LearningBootstrapCardProps) {
  return (
    <PremiumSection
      title="Business Intelligence Setup"
      subtitle="Historical import and intelligence domain readiness"
      icon={<IconMemory size={20} />}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div className={styles.healthLayout}>
          <ProgressRing
            value={learning.overallConfidencePercent}
            label="Overall confidence"
            color="#7c3aed"
          />
          <div className={styles.healthBreakdown}>
            <strong>{learning.merchantHeadline}</strong>
            <p className={styles.sectionSubtitle}>{learning.merchantMessage}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
              <s-badge tone="info">{learning.stageLabel}</s-badge>
              {learning.estimatedCompletionMinutes > 0 ? (
                <span className={styles.sectionSubtitle}>
                  ETA: {learning.estimatedCompletionMinutes} minutes
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className={styles.syncGrid}>
          <div className={styles.syncTile}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <IconSync size={18} />
              <strong>Historical import</strong>
            </div>
            {learning.importSteps.map((step) => (
              <div
                key={step.key}
                style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}
              >
                <span style={{ color: step.status === "complete" ? "#008060" : "#6d7175" }}>
                  {stepIcon(step.status)}
                </span>
                <span>{step.label}</span>
              </div>
            ))}
          </div>

          <div className={styles.syncTile}>
            <strong style={{ display: "block", marginBottom: 10 }}>Intelligence domains</strong>
            {learning.domains.map((domain) => (
              <div key={domain.domain} style={{ marginBottom: 14 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 6,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span>{domain.label}</span>
                    <s-badge>{domain.statusLabel}</s-badge>
                  </div>
                  <span className={styles.breakdownValue}>{domain.confidencePercent}%</span>
                </div>
                <div className={styles.progressTrack}>
                  <div
                    className={styles.progressFill}
                    style={{
                      width: `${Math.max(0, Math.min(100, domain.confidencePercent))}%`,
                      background: "linear-gradient(90deg, #7c3aed, #5c6ac4)",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.metricGrid}>
          {[
            { label: "Executive COO", ready: learning.executiveCooReady },
            { label: "Prediction", ready: learning.predictionReady },
            { label: "Experiments", ready: learning.experimentReady },
            { label: "Adaptive", ready: learning.merchantIntelligenceReady },
          ].map((item) => (
            <article key={item.label} className={styles.metricTile}>
              <div className={styles.metricLabel}>{item.label}</div>
              <div className={styles.metricValue} style={{ fontSize: "1.1rem" }}>
                {item.ready ? "Ready" : "Building"}
              </div>
              <div className={styles.metricTrend} style={{ color: item.ready ? "#008060" : "#6d7175" }}>
                {item.ready ? "Available now" : "In progress"}
              </div>
            </article>
          ))}
        </div>
      </div>
    </PremiumSection>
  );
}
