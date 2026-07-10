import styles from "../intelligence-workspace.module.css";

type BusinessDNAViewerProps = {
  version: number;
  characteristics: Record<string, unknown>;
  decisionStyle?: string;
  optimizationMaturity?: number;
  experimentMaturity?: number;
  riskTolerance?: string;
};

export function BusinessDNAViewer({
  version,
  characteristics,
  decisionStyle,
  optimizationMaturity,
  experimentMaturity,
  riskTolerance,
}: BusinessDNAViewerProps) {
  const entries = Object.entries(characteristics).slice(0, 12);

  return (
    <s-box padding="base" background="base" borderWidth="small" borderColor="base" borderRadius="base">
      <s-stack gap="base">
        <s-stack direction="inline" justifyContent="space-between" alignItems="center">
          <s-text type="strong">Business DNA</s-text>
          <s-badge>v{version}</s-badge>
        </s-stack>
        <div className={styles.badgeRow}>
          {decisionStyle ? <span className={styles.badge}>{decisionStyle}</span> : null}
          {riskTolerance ? <span className={styles.badge}>{riskTolerance} risk</span> : null}
          {optimizationMaturity != null ? (
            <span className={styles.badge}>Optimization {optimizationMaturity}%</span>
          ) : null}
          {experimentMaturity != null ? (
            <span className={styles.badge}>Experiment {experimentMaturity}%</span>
          ) : null}
        </div>
        {entries.length === 0 ? (
          <p className={styles.emptyState}>Business DNA will evolve as StorePilot learns.</p>
        ) : (
          <s-unordered-list>
            {entries.map(([key, value]) => (
              <s-list-item key={key}>
                {key}: {String(value)}
              </s-list-item>
            ))}
          </s-unordered-list>
        )}
      </s-stack>
    </s-box>
  );
}

export function AdaptiveScoreCard({ score }: { score: number }) {
  return (
    <s-box padding="base" background="base" borderWidth="small" borderColor="base" borderRadius="base">
      <s-stack gap="small-200">
        <s-text color="subdued">Adaptive Intelligence</s-text>
        <s-heading>{score}</s-heading>
        <s-text color="subdued">How effectively StorePilot learns from your decisions</s-text>
      </s-stack>
    </s-box>
  );
}

export function BusinessMemoryCard({
  patternCount,
  snapshotCount,
  lastUpdated,
}: {
  patternCount: number;
  snapshotCount: number;
  lastUpdated: string | null;
}) {
  return (
    <s-box padding="base" background="base" borderWidth="small" borderColor="base" borderRadius="base">
      <s-stack gap="small-200">
        <s-text type="strong">Business memory</s-text>
        <s-text color="subdued">{patternCount} patterns · {snapshotCount} snapshots</s-text>
        {lastUpdated ? (
          <s-text color="subdued">Last updated {new Date(lastUpdated).toLocaleString()}</s-text>
        ) : null}
      </s-stack>
    </s-box>
  );
}

export function ExecutiveCard({
  title,
  summary,
  badge,
  children,
}: {
  title: string;
  summary: string;
  badge?: string;
  children?: React.ReactNode;
}) {
  return (
    <s-box padding="base" background="base" borderWidth="small" borderColor="base" borderRadius="base">
      <s-stack gap="small-200">
        <s-stack direction="inline" justifyContent="space-between" alignItems="center">
          <s-text type="strong">{title}</s-text>
          {badge ? <s-badge>{badge}</s-badge> : null}
        </s-stack>
        <s-text color="subdued">{summary}</s-text>
        {children}
      </s-stack>
    </s-box>
  );
}

export function DecisionCard({
  title,
  category,
  cause,
  confidencePercent,
}: {
  title: string;
  category: string;
  cause: string;
  confidencePercent?: number;
}) {
  return (
    <ExecutiveCard title={title} summary={cause} badge={category}>
      {confidencePercent != null ? (
        <s-text color="subdued">{confidencePercent}% confidence</s-text>
      ) : null}
    </ExecutiveCard>
  );
}
