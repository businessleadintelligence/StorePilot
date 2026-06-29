import { useMemo, useState } from "react";

import type { ExecutiveChartPoint } from "../../services/executive-dashboard.types";
import styles from "./executive-dashboard.module.css";

type ExecutiveChartProps = {
  title: string;
  points: ExecutiveChartPoint[];
  ariaLabel: string;
  formatValue?: (value: number) => string;
  variant?: "line" | "bar";
};

export function ExecutiveChart({
  title,
  points,
  ariaLabel,
  formatValue = (value) => String(value),
  variant = "line",
}: ExecutiveChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const geometry = useMemo(() => {
    if (points.length === 0) {
      return null;
    }

    const width = 320;
    const height = 160;
    const padding = 16;
    const maxValue = Math.max(...points.map((point) => point.value), 1);
    const stepX = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;

    const coordinates = points.map((point, index) => {
      const x = padding + stepX * index;
      const y = height - padding - (point.value / maxValue) * (height - padding * 2);
      return { x, y, point, index };
    });

    const polyline = coordinates.map(({ x, y }) => `${x},${y}`).join(" ");
    return { width, height, coordinates, polyline, maxValue };
  }, [points]);

  return (
    <div className={`${styles.card} ${styles.chartCard}`} aria-label={ariaLabel}>
      <div className={styles.sectionTitle}>{title}</div>
      {!geometry ? (
        <div className={styles.emptyState}>No chart data yet.</div>
      ) : (
        <>
          <svg
            className={styles.chartSvg}
            viewBox={`0 0 ${geometry.width} ${geometry.height}`}
            role="img"
            aria-label={ariaLabel}
          >
            {variant === "bar"
              ? geometry.coordinates.map(({ x, y, point, index }) => (
                  <rect
                    key={point.label}
                    x={x - 10}
                    y={y}
                    width={20}
                    height={geometry.height - y - 16}
                    fill={activeIndex === index ? "#7c5cff" : "rgba(124, 92, 255, 0.55)"}
                    rx={6}
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseLeave={() => setActiveIndex(null)}
                    onFocus={() => setActiveIndex(index)}
                    onBlur={() => setActiveIndex(null)}
                    tabIndex={0}
                  />
                ))
              : (
                  <>
                    <polyline
                      fill="none"
                      stroke="#7c5cff"
                      strokeWidth="3"
                      points={geometry.polyline}
                    />
                    {geometry.coordinates.map(({ x, y, index }) => (
                      <circle
                        key={`point-${index}`}
                        cx={x}
                        cy={y}
                        r={activeIndex === index ? 6 : 4}
                        fill="#22c7a9"
                        onMouseEnter={() => setActiveIndex(index)}
                        onMouseLeave={() => setActiveIndex(null)}
                      />
                    ))}
                  </>
                )}
          </svg>
          <div className={styles.cardMeta}>
            {activeIndex != null
              ? `${points[activeIndex].label}: ${formatValue(points[activeIndex].value)}`
              : `${points.length} data points`}
          </div>
        </>
      )}
    </div>
  );
}
