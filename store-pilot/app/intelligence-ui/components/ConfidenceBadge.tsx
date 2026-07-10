import styles from "../intelligence-workspace.module.css";

type ConfidenceBadgeProps = {
  confidencePercent: number;
};

export function ConfidenceBadge({ confidencePercent }: ConfidenceBadgeProps) {
  const tone =
    confidencePercent >= 85
      ? styles.badgeSuccess
      : confidencePercent >= 60
        ? styles.badgeInfo
        : styles.badgeWarning;

  return (
    <span className={`${styles.badge} ${tone}`} aria-label={`${confidencePercent}% confidence`}>
      {confidencePercent}% confidence
    </span>
  );
}
