import styles from "../intelligence-workspace.module.css";

type RevenueBadgeProps = {
  amount: number;
  currency: string;
  label?: string;
};

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function RevenueBadge({ amount, currency, label = "Revenue impact" }: RevenueBadgeProps) {
  return (
    <span className={`${styles.badge} ${styles.badgeInfo}`}>
      {label}: {formatCurrency(amount, currency)}
    </span>
  );
}
