import styles from "../intelligence-workspace.module.css";

type ImpactBadgeProps = {
  label: string;
  severity: "low" | "medium" | "high" | "critical";
};

export function ImpactBadge({ label, severity }: ImpactBadgeProps) {
  const tone =
    severity === "critical"
      ? styles.badgeCritical
      : severity === "high"
        ? styles.badgeWarning
        : severity === "medium"
          ? styles.badgeInfo
          : styles.badgeSuccess;

  return <span className={`${styles.badge} ${tone}`}>{label}</span>;
}
