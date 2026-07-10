import styles from "./premium-dashboard.module.css";

type ProgressRingProps = {
  value: number;
  max?: number;
  label: string;
  color?: string;
  size?: number;
};

export function ProgressRing({
  value,
  max = 100,
  label,
  color = "#5c6ac4",
  size = 132,
}: ProgressRingProps) {
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const normalized = Math.max(0, Math.min(max, value));
  const dash = (normalized / max) * circumference;

  return (
    <div className={styles.ringWrap}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(92, 106, 196, 0.12)"
          strokeWidth="10"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text
          x="50%"
          y="50%"
          dominantBaseline="middle"
          textAnchor="middle"
          fontSize="24"
          fontWeight="700"
          fill="#202223"
        >
          {Math.round(normalized)}
        </text>
      </svg>
      <span className={styles.ringLabel}>{label}</span>
    </div>
  );
}
