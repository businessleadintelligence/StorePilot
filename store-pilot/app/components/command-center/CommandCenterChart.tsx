import { useId, useMemo, useState } from "react";

import type { ExecutiveChartPoint } from "../../services/executive-dashboard.types";
import styles from "./command-center.module.css";

type CommandCenterChartProps = {
  title: string;
  points: ExecutiveChartPoint[];
  ariaLabel: string;
  formatValue?: (value: number) => string;
  variant?: "line" | "bar" | "area";
  secondaryPoints?: ExecutiveChartPoint[];
  secondaryLabel?: string;
};

export function CommandCenterChart({
  title,
  points,
  ariaLabel,
  formatValue = (value) => String(value),
  variant = "area",
  secondaryPoints,
  secondaryLabel = "Secondary",
}: CommandCenterChartProps) {
  const gradientId = useId().replace(/:/g, "");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const geometry = useMemo(() => {
    if (points.length === 0) {
      return null;
    }

    const width = 340;
    const height = 180;
    const padding = 18;
    const allValues = [
      ...points.map((point) => point.value),
      ...(secondaryPoints?.map((point) => point.value) ?? []),
    ];
    const maxValue = Math.max(...allValues, 1);
    const stepX = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;

    const coordinates = points.map((point, index) => {
      const x = padding + stepX * index;
      const y = height - padding - (point.value / maxValue) * (height - padding * 2);
      return { x, y, point, index };
    });

    const secondaryCoordinates =
      secondaryPoints?.map((point, index) => {
        const x = padding + stepX * index;
        const y = height - padding - (point.value / maxValue) * (height - padding * 2);
        return { x, y, point, index };
      }) ?? [];

    const areaPath =
      coordinates.length > 0
        ? `M ${coordinates[0].x} ${height - padding} ${coordinates
            .map(({ x, y }) => `L ${x} ${y}`)
            .join(" ")} L ${coordinates[coordinates.length - 1].x} ${height - padding} Z`
        : "";

    return {
      width,
      height,
      padding,
      coordinates,
      secondaryCoordinates,
      polyline: coordinates.map(({ x, y }) => `${x},${y}`).join(" "),
      secondaryPolyline: secondaryCoordinates.map(({ x, y }) => `${x},${y}`).join(" "),
      areaPath,
      maxValue,
    };
  }, [points, secondaryPoints]);

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
            <defs>
              <linearGradient id={`${gradientId}-primary`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(124, 92, 255, 0.55)" />
                <stop offset="100%" stopColor="rgba(124, 92, 255, 0.02)" />
              </linearGradient>
              <linearGradient id={`${gradientId}-secondary`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(255, 93, 93, 0.45)" />
                <stop offset="100%" stopColor="rgba(255, 93, 93, 0.02)" />
              </linearGradient>
            </defs>

            {variant === "bar"
              ? geometry.coordinates.map(({ x, y, point, index }) => (
                  <rect
                    key={point.label}
                    x={x - 12}
                    y={y}
                    width={24}
                    height={geometry.height - y - geometry.padding}
                    fill={activeIndex === index ? "#7c5cff" : "url(#" + `${gradientId}-primary` + ")"}
                    rx={8}
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseLeave={() => setActiveIndex(null)}
                    onFocus={() => setActiveIndex(index)}
                    onBlur={() => setActiveIndex(null)}
                    tabIndex={0}
                    aria-label={`${point.label}: ${formatValue(point.value)}`}
                  />
                ))
              : (
                  <>
                    {variant === "area" ? (
                      <path d={geometry.areaPath} fill={`url(#${gradientId}-primary)`} />
                    ) : null}
                    <polyline
                      fill="none"
                      stroke="#7c5cff"
                      strokeWidth="3"
                      points={geometry.polyline}
                    />
                    {geometry.secondaryCoordinates.length > 0 ? (
                      <polyline
                        fill="none"
                        stroke="#ff5d5d"
                        strokeWidth="2.5"
                        strokeDasharray="6 4"
                        points={geometry.secondaryPolyline}
                      />
                    ) : null}
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
          <div className={styles.chartMeta}>
            {activeIndex != null
              ? `${points[activeIndex].label}: ${formatValue(points[activeIndex].value)}${
                  secondaryPoints?.[activeIndex]
                    ? ` · ${secondaryLabel}: ${formatValue(secondaryPoints[activeIndex].value)}`
                    : ""
                }`
              : `${points.length} data points`}
          </div>
        </>
      )}
    </div>
  );
}
