type OperationalReadinessGaugeProps = {
  score: number;
};

export function OperationalReadinessGauge({ score }: OperationalReadinessGaugeProps) {
  return (
    <s-box padding="base" background="base" borderWidth="small" borderColor="base" borderRadius="base">
      <s-stack gap="small-200">
        <s-stack direction="inline" justifyContent="space-between" alignItems="center">
          <s-text type="strong">Operational Readiness</s-text>
          <s-badge tone={score >= 70 ? "success" : score >= 50 ? "warning" : "critical"}>
            {score}/100
          </s-badge>
        </s-stack>
        <div
          role="progressbar"
          aria-valuenow={score}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Operational Readiness"
          style={{
            height: "8px",
            borderRadius: "999px",
            background: "var(--p-color-bg-surface-secondary, #e3e3e3)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${Math.max(0, Math.min(100, score))}%`,
              height: "100%",
              borderRadius: "999px",
              background: "var(--p-color-bg-fill-success, #008060)",
            }}
          />
        </div>
      </s-stack>
    </s-box>
  );
}
