export function formatCurrency(amount: number, currency = "USD"): string {
  const safeAmount = Number.isFinite(amount) ? Math.max(0, amount) : 0;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(safeAmount);
}

export function formatMetricNumber(value: number): string {
  const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0;

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: safeValue % 1 === 0 ? 0 : 2,
  }).format(safeValue);
}

export function formatRelativeTime(isoDate: string, now = Date.now()): string {
  const deltaMs = now - new Date(isoDate).getTime();
  const minutes = Math.max(0, Math.round(deltaMs / 60_000));

  if (minutes < 1) {
    return "just now";
  }

  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours = Math.round(minutes / 60);
  if (hours < 48) {
    return `${hours} hr ago`;
  }

  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function formatDurationMs(durationMs: number | null): string {
  if (durationMs == null || durationMs <= 0) {
    return "—";
  }

  if (durationMs < 1000) {
    return `${durationMs} ms`;
  }

  return `${(durationMs / 1000).toFixed(1)} sec`;
}
