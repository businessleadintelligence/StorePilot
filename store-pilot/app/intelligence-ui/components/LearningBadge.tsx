import styles from "../intelligence-workspace.module.css";

type LearningBadgeProps = {
  stage: string;
};

export function LearningBadge({ stage }: LearningBadgeProps) {
  return <span className={`${styles.badge} ${styles.badgeSuccess}`}>Learning: {stage}</span>;
}
