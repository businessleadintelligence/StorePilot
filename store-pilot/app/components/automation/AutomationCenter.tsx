import type { AutomationCenterData } from "../../automation/automation-types";
import { AutomationChart } from "./AutomationChart";
import styles from "./automation-center.module.css";

type AutomationCenterProps = {
  data: AutomationCenterData;
};

const RISK_CLASS: Record<string, string> = {
  low: styles.chipLow,
  medium: styles.chip,
  high: styles.chipCritical,
  critical: styles.chipCritical,
};

export function AutomationCenter({ data }: AutomationCenterProps) {
  return (
    <div className={styles.dashboard} aria-label="AI Automation Center">
      <div className={styles.shell}>
        <header>
          <h1 className={styles.heroTitle}>AI Automation Center</h1>
          <p className={styles.heroSubtitle}>
            Convert approved operations into merchant-controlled automations. No Shopify actions execute without approval.
          </p>
        </header>

        <section className={styles.grid} aria-label="Automation metrics">
          <div className={styles.card}>
            <div className={styles.cardLabel}>Prepared</div>
            <div className={styles.cardValue}>{data.metrics.automationsPrepared}</div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardLabel}>Approval Rate</div>
            <div className={styles.cardValue}>{Math.round(data.metrics.approvalRate * 100)}%</div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardLabel}>Execution Rate</div>
            <div className={styles.cardValue}>{Math.round(data.metrics.executionRate * 100)}%</div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardLabel}>Time Saved</div>
            <div className={styles.cardValue}>{data.metrics.merchantTimeSavedMinutes}m</div>
          </div>
        </section>

        <section className={styles.section} aria-label="Pending approvals">
          <h2 className={styles.sectionTitle}>Pending Approvals</h2>
          {data.pendingApprovals.length === 0 ? (
            <p className={styles.previewBox}>No automations waiting for merchant approval.</p>
          ) : (
            data.pendingApprovals.slice(0, 5).map((automation) => (
              <article key={automation.id} className={styles.automationCard}>
                <div className={styles.chipRow}>
                  <span className={RISK_CLASS[automation.riskLevel] ?? styles.chip}>{automation.riskLevel}</span>
                  <span className={styles.chip}>{automation.templateId}</span>
                </div>
                <h3 className={styles.automationTitle}>{automation.title}</h3>
                <div className={styles.automationMeta}>
                  {automation.preview.products.join(", ") || "No products"} · Approve · Reject · Request Changes
                </div>
              </article>
            ))
          )}
        </section>

        <section className={styles.section} aria-label="Automation queue">
          <h2 className={styles.sectionTitle}>Automation Queue</h2>
          <ul className={styles.list}>
            {data.automationQueue.slice(0, 5).map((automation) => (
              <li key={automation.id}>
                {automation.title} · {automation.status} · Risk {automation.riskLevel}
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.section} aria-label="Execution timeline">
          <h2 className={styles.sectionTitle}>Execution Timeline</h2>
          <ul className={styles.list}>
            {data.executionTimeline.slice(0, 5).map((event) => (
              <li key={event.id}>
                {event.message} · {event.at}
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.section} aria-label="Verification queue">
          <h2 className={styles.sectionTitle}>Verification Queue</h2>
          <div className={styles.cardValue}>{data.verificationQueue.length} awaiting verification</div>
        </section>

        <section className={styles.section} aria-label="Risk analysis">
          <h2 className={styles.sectionTitle}>Risk Analysis</h2>
          <ul className={styles.list}>
            {data.riskAnalysis.slice(0, 5).map((item) => (
              <li key={item.automationId}>
                {item.title} · {item.riskLevel} · {item.factors.join(", ")}
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.section} aria-label="Automation history">
          <h2 className={styles.sectionTitle}>Automation History</h2>
          <ul className={styles.list}>
            {data.automationHistory.slice(0, 5).map((event) => (
              <li key={event.id}>{event.eventType}: {event.message}</li>
            ))}
          </ul>
        </section>

        <section className={styles.section} aria-label="Automation charts">
          <h2 className={styles.sectionTitle}>Execution Metrics</h2>
          <div className={styles.chartGrid}>
            <AutomationChart
              title="Automation Success Rate"
              points={data.charts.successRate}
              ariaLabel="Automation success rate chart"
            />
            <AutomationChart
              title="Approval Funnel"
              points={data.charts.approvalFunnel}
              ariaLabel="Approval funnel chart"
            />
            <AutomationChart
              title="Execution Timeline"
              points={data.charts.executionTimeline}
              ariaLabel="Execution timeline chart"
            />
            <AutomationChart
              title="Risk Distribution"
              points={data.charts.riskDistribution}
              ariaLabel="Risk distribution chart"
            />
            <AutomationChart
              title="Automation Types"
              points={data.charts.automationTypes}
              ariaLabel="Automation types chart"
            />
            <AutomationChart
              title="Verification Success"
              points={data.charts.verificationSuccess}
              ariaLabel="Verification success chart"
            />
            <AutomationChart
              title="Automation Heatmap"
              points={data.charts.automationHeatmap}
              ariaLabel="Automation heatmap chart"
            />
            <AutomationChart
              title="Time Saved"
              points={data.charts.timeSaved}
              ariaLabel="Time saved chart"
            />
            <AutomationChart
              title="ROI Delivered"
              points={data.charts.roiDelivered}
              ariaLabel="ROI delivered chart"
            />
            <AutomationChart
              title="Merchant Approval Rate"
              points={data.charts.merchantApprovalRate}
              ariaLabel="Merchant approval rate chart"
            />
          </div>
        </section>

        <section className={styles.section} aria-label="Notifications">
          <h2 className={styles.sectionTitle}>Notifications</h2>
          <ul className={styles.list}>
            {data.notifications.slice(0, 5).map((notification) => (
              <li key={notification.id}>
                {notification.title}: {notification.message}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
