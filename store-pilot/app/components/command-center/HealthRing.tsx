import type { CommandCenterHealthRing } from "../../services/command-center.types";
import styles from "./command-center.module.css";

type HealthRingProps = {
  ring: CommandCenterHealthRing;
  ariaLabel?: string;
};

const SEGMENT_COLORS = ["#22c7a9", "#7c5cff", "#5b8cff", "#ffb020", "#ff8bd4"];

export function HealthRing({ ring, ariaLabel = "Store health ring" }: HealthRingProps) {
  const radius = 88;
  const stroke = 14;
  const circumference = 2 * Math.PI * radius;
  const segmentLength = circumference / ring.segments.length;
  let offset = 0;

  return (
    <div className={styles.healthRingWrap} aria-label={ariaLabel}>
      <svg className={styles.healthRingSvg} viewBox="0 0 240 240" role="img" aria-label={ariaLabel}>
        <circle
          cx="120"
          cy="120"
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={stroke}
        />
        {ring.segments.map((segment, index) => {
          const dash = (segment.value / 100) * segmentLength;
          const element = (
            <circle
              key={segment.label}
              cx="120"
              cy="120"
              r={radius}
              fill="none"
              stroke={SEGMENT_COLORS[index % SEGMENT_COLORS.length]}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 120 120)"
            />
          );
          offset += segmentLength;
          return element;
        })}
        <text
          x="120"
          y="118"
          textAnchor="middle"
          className={styles.healthRingCenter}
          fill="#f4f7fb"
          fontSize="42"
          fontWeight="700"
        >
          {ring.score}
        </text>
        <text x="120" y="142" textAnchor="middle" fill="#9aa4b2" fontSize="12">
          Store Health
        </text>
      </svg>
      <div className={styles.healthRingLegend}>
        {ring.segments.map((segment) => (
          <div key={segment.label} className={styles.healthRingLegendItem}>
            <span>{segment.label}</span>
            <strong>{segment.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
