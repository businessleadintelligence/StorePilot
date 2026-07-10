import styles from "./premium-dashboard.module.css";

type MiniSparklineProps = {
  values: number[];
  color?: string;
  ariaLabel?: string;
};

export function MiniSparkline({
  values,
  color = "#5c6ac4",
  ariaLabel = "Trend sparkline",
}: MiniSparklineProps) {
  if (values.length === 0) {
    return null;
  }

  const width = 120;
  const height = 42;
  const padding = 4;
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? (width - padding * 2) / (values.length - 1) : 0;

  const points = values
    .map((value, index) => {
      const x = padding + step * index;
      const y = height - padding - (value / max) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      className={styles.sparkline}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel}
    >
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points}
      />
      <polygon
        fill="url(#sparkFill)"
        points={`${padding},${height - padding} ${points} ${width - padding},${height - padding}`}
      />
    </svg>
  );
}
