import styles from "./premium-dashboard.module.css";

type DeferredSectionSkeletonProps = {
  title?: string;
  lines?: number;
};

export function DeferredSectionSkeleton({
  title = "Loading intelligence…",
  lines = 3,
}: DeferredSectionSkeletonProps) {
  return (
    <div className={styles.deferredSkeleton} aria-busy="true" aria-label={title}>
      <div className={styles.deferredSkeletonTitle}>{title}</div>
      {Array.from({ length: lines }, (_, index) => (
        <div
          key={index}
          className={styles.deferredSkeletonLine}
          style={{ width: `${88 - index * 12}%` }}
        />
      ))}
    </div>
  );
}
