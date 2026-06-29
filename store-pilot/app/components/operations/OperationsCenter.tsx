import type { OperationsCenterData } from "../../operations/operations-types";
import { OperationsChart } from "./OperationsChart";
import styles from "./operations-center.module.css";

type OperationsCenterProps = {
  data: OperationsCenterData;
};

const KANBAN_LABELS = {
  planned: "Planned",
  approved: "Approved",
  in_progress: "In Progress",
  blocked: "Blocked",
  verification: "Verification",
  completed: "Completed",
} as const;

export function OperationsCenter({ data }: OperationsCenterProps) {
  return (
    <div className={styles.dashboard} aria-label="AI Operations Center">
      <div className={styles.shell}>
        <header>
          <h1 className={styles.heroTitle}>AI Operations Center</h1>
          <p className={styles.heroSubtitle}>
            Execute executive decisions, track progress, and verify outcomes without running AI on page load.
          </p>
        </header>

        <section className={styles.grid} aria-label="Operations metrics">
          <div className={styles.card}>
            <div className={styles.cardLabel}>Execution Rate</div>
            <div className={styles.cardValue}>{Math.round(data.metrics.executionRate * 100)}%</div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardLabel}>Completion Rate</div>
            <div className={styles.cardValue}>{Math.round(data.metrics.completionRate * 100)}%</div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardLabel}>Verification Success</div>
            <div className={styles.cardValue}>
              {Math.round(data.metrics.verificationSuccessRate * 100)}%
            </div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardLabel}>Avg Completion</div>
            <div className={styles.cardValue}>{Math.round(data.metrics.averageCompletionMinutes)}m</div>
          </div>
        </section>

        <section className={styles.section} aria-label="AI inbox">
          <h2 className={styles.sectionTitle}>AI Inbox</h2>
          <div className={styles.grid}>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Waiting Approval</div>
              <div className={styles.cardValue}>{data.inbox.waitingApproval.length}</div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>In Progress</div>
              <div className={styles.cardValue}>{data.inbox.inProgress.length}</div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Blocked</div>
              <div className={styles.cardValue}>{data.inbox.blocked.length}</div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Needs Verification</div>
              <div className={styles.cardValue}>{data.inbox.needsVerification.length}</div>
            </div>
          </div>
        </section>

        <section className={styles.section} aria-label="Execution queue">
          <h2 className={styles.sectionTitle}>Smart Queue</h2>
          <ul className={styles.list}>
            {data.queue.slice(0, 5).map((operation) => (
              <li key={operation.id}>
                {operation.title} · Priority {operation.priority} · {operation.progressPercent}% complete
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.section} aria-label="Progress board">
          <h2 className={styles.sectionTitle}>Kanban</h2>
          <div className={styles.kanban} role="list" aria-label="Operations kanban board">
            {Object.entries(KANBAN_LABELS).map(([column, label]) => (
              <div key={column} className={styles.kanbanColumn} role="listitem" aria-label={label}>
                <div className={styles.kanbanTitle}>
                  {label} ({data.kanban[column as keyof typeof data.kanban]?.length ?? 0})
                </div>
                {(data.kanban[column as keyof typeof data.kanban] ?? []).slice(0, 3).map((operation) => (
                  <article key={operation.id} className={styles.operationCard}>
                    <div className={styles.chipRow}>
                      <span className={styles.chip}>{operation.priority}</span>
                      {operation.status === "blocked" ? (
                        <span className={`${styles.chip} ${styles.chipCritical}`}>Blocked</span>
                      ) : null}
                    </div>
                    <h3 className={styles.operationTitle}>{operation.title}</h3>
                    <div className={styles.operationMeta}>
                      {operation.progressPercent}% · {operation.estimatedRemainingMinutes}m remaining
                    </div>
                  </article>
                ))}
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section} aria-label="Operations calendar">
          <h2 className={styles.sectionTitle}>Operations Calendar</h2>
          <div className={styles.grid}>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Today</div>
              <div className={styles.cardValue}>{data.calendar.today.length}</div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Tomorrow</div>
              <div className={styles.cardValue}>{data.calendar.tomorrow.length}</div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>This Week</div>
              <div className={styles.cardValue}>{data.calendar.thisWeek.length}</div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Later</div>
              <div className={styles.cardValue}>{data.calendar.later.length}</div>
            </div>
          </div>
        </section>

        <section className={styles.chartGrid} aria-label="Operations performance charts">
          <OperationsChart title="Operations Burn-down" points={data.charts.burnDown} ariaLabel="Operations burn-down chart" />
          <OperationsChart title="Completion Velocity" points={data.charts.completionVelocity} ariaLabel="Completion velocity chart" />
          <OperationsChart title="Verification Funnel" points={data.charts.verificationFunnel} ariaLabel="Verification funnel chart" />
          <OperationsChart title="Kanban Flow" points={data.charts.kanbanFlow} ariaLabel="Kanban flow chart" />
          <OperationsChart title="Revenue Delivered" points={data.charts.revenueDelivered} ariaLabel="Revenue delivered chart" />
          <OperationsChart title="Capacity Gauge" points={data.charts.capacityGauge} ariaLabel="Capacity gauge chart" />
        </section>

        <section className={styles.section} aria-label="Verification queue">
          <h2 className={styles.sectionTitle}>Verification Queue</h2>
          <ul className={styles.list}>
            {data.verificationQueue.slice(0, 5).map((operation) => (
              <li key={operation.id}>{operation.title}</li>
            ))}
          </ul>
        </section>

        <section className={styles.section} aria-label="Achievements">
          <h2 className={styles.sectionTitle}>Achievements</h2>
          <ul className={styles.list}>
            {data.achievements.map((achievement) => (
              <li key={achievement}>{achievement}</li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
