import styles from "./automation-center.module.css";

export type AutomationChartPoint = {
  label: string;
  value: number;
};

type AutomationChartProps = {
  title: string;
  points: AutomationChartPoint[];
  ariaLabel: string;
  animated?: boolean;
};

export function AutomationChart({ title, points, ariaLabel, animated = true }: AutomationChartProps) {
  const max = Math.max(...points.map((point) => point.value), 1);

  return (
    <figure className={styles.chartCard} aria-label={ariaLabel}>
      <figcaption className={styles.chartTitle}>{title}</figcaption>
      <svg viewBox="0 0 320 160" className={styles.chartSvg} role="img" aria-hidden="true">
        <defs>
          <linearGradient id="autoGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#9b8cff" />
            <stop offset="100%" stopColor="#22c7a9" />
          </linearGradient>
        </defs>
        {points.map((point, index) => {
          const barHeight = (point.value / max) * 110;
          const x = 24 + index * (280 / Math.max(points.length, 1));
          return (
            <g key={point.label}>
              <rect
                x={x}
                y={130 - barHeight}
                width={24}
                height={barHeight}
                rx={6}
                className={animated ? styles.chartBarAnimated : styles.chartBar}
              />
              <text x={x + 12} y={148} textAnchor="middle" className={styles.chartLabel}>
                {point.label.slice(0, 8)}
              </text>
            </g>
          );
        })}
      </svg>
      <ul className={styles.srOnly}>
        {points.map((point) => (
          <li key={point.label}>
            {point.label}: {point.value}
          </li>
        ))}
      </ul>
    </figure>
  );
}
