export type DatabaseQueryMetric = {
  model: string;
  operation: string;
  durationMs: number;
  timestamp: string;
  slow: boolean;
};

export type DatabaseTransactionMetric = {
  label: string;
  durationMs: number;
  timestamp: string;
  slow: boolean;
};

export type DatabaseMetricsSnapshot = {
  queryCount: number;
  slowQueryCount: number;
  retryCount: number;
  transactionCount: number;
  slowTransactionCount: number;
  connectionWaitMs: number;
  poolUtilizationEstimate: number | null;
  averageQueryDurationMs: number;
  p95QueryDurationMs: number;
  recentSlowQueries: DatabaseQueryMetric[];
  recentSlowTransactions: DatabaseTransactionMetric[];
};

const SLOW_QUERY_THRESHOLD_MS = 250;
const SLOW_TRANSACTION_THRESHOLD_MS = 500;
const MAX_RECENT_SLOW_QUERIES = 20;
const MAX_RECENT_SLOW_TRANSACTIONS = 10;
const MAX_DURATION_SAMPLES = 500;

let queryCount = 0;
let slowQueryCount = 0;
let retryCount = 0;
let transactionCount = 0;
let slowTransactionCount = 0;
let connectionWaitMs = 0;
let activeConnections = 0;
let peakActiveConnections = 0;

const queryDurationsMs: number[] = [];
const recentSlowQueries: DatabaseQueryMetric[] = [];
const recentSlowTransactions: DatabaseTransactionMetric[] = [];

function pushDurationSample(samples: number[], durationMs: number): void {
  samples.push(durationMs);
  if (samples.length > MAX_DURATION_SAMPLES) {
    samples.shift();
  }
}

function percentile(values: number[], pct: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((pct / 100) * sorted.length) - 1),
  );
  return sorted[index] ?? 0;
}

export function recordDatabaseQuery(input: {
  model: string;
  operation: string;
  durationMs: number;
}): void {
  queryCount += 1;
  pushDurationSample(queryDurationsMs, input.durationMs);

  const slow = input.durationMs >= SLOW_QUERY_THRESHOLD_MS;
  if (slow) {
    slowQueryCount += 1;
    recentSlowQueries.unshift({
      model: input.model,
      operation: input.operation,
      durationMs: Math.round(input.durationMs * 100) / 100,
      timestamp: new Date().toISOString(),
      slow: true,
    });
    if (recentSlowQueries.length > MAX_RECENT_SLOW_QUERIES) {
      recentSlowQueries.pop();
    }

    if (process.env.NODE_ENV !== "test") {
      console.warn("[db-slow-query]", {
        model: input.model,
        operation: input.operation,
        durationMs: Math.round(input.durationMs),
      });
    }
  }
}

export function recordDatabaseTransaction(input: {
  label: string;
  durationMs: number;
}): void {
  transactionCount += 1;
  const slow = input.durationMs >= SLOW_TRANSACTION_THRESHOLD_MS;
  if (slow) {
    slowTransactionCount += 1;
    recentSlowTransactions.unshift({
      label: input.label,
      durationMs: Math.round(input.durationMs * 100) / 100,
      timestamp: new Date().toISOString(),
      slow: true,
    });
    if (recentSlowTransactions.length > MAX_RECENT_SLOW_TRANSACTIONS) {
      recentSlowTransactions.pop();
    }

    if (process.env.NODE_ENV !== "test") {
      console.warn("[db-slow-transaction]", {
        label: input.label,
        durationMs: Math.round(input.durationMs),
      });
    }
  }
}

export function recordDatabaseRetry(): void {
  retryCount += 1;
}

export function recordConnectionWait(durationMs: number): void {
  connectionWaitMs += durationMs;
}

export function markDatabaseConnectionAcquired(): void {
  activeConnections += 1;
  peakActiveConnections = Math.max(peakActiveConnections, activeConnections);
}

export function markDatabaseConnectionReleased(): void {
  activeConnections = Math.max(0, activeConnections - 1);
}

export function getDatabaseMetricsSnapshot(): DatabaseMetricsSnapshot {
  const totalQueryDurationMs = queryDurationsMs.reduce(
    (sum, value) => sum + value,
    0,
  );

  const configuredPoolLimit = resolveConfiguredPoolLimit();

  return {
    queryCount,
    slowQueryCount,
    retryCount,
    transactionCount,
    slowTransactionCount,
    connectionWaitMs: Math.round(connectionWaitMs),
    poolUtilizationEstimate:
      configuredPoolLimit !== null
        ? Math.min(
            1,
            Math.round((peakActiveConnections / configuredPoolLimit) * 1000) /
              1000,
          )
        : null,
    averageQueryDurationMs:
      queryDurationsMs.length === 0
        ? 0
        : Math.round((totalQueryDurationMs / queryDurationsMs.length) * 100) /
          100,
    p95QueryDurationMs: Math.round(percentile(queryDurationsMs, 95) * 100) / 100,
    recentSlowQueries: [...recentSlowQueries],
    recentSlowTransactions: [...recentSlowTransactions],
  };
}

export function resetDatabaseMetricsForTests(): void {
  queryCount = 0;
  slowQueryCount = 0;
  retryCount = 0;
  transactionCount = 0;
  slowTransactionCount = 0;
  connectionWaitMs = 0;
  activeConnections = 0;
  peakActiveConnections = 0;
  queryDurationsMs.length = 0;
  recentSlowQueries.length = 0;
  recentSlowTransactions.length = 0;
}

function resolveConfiguredPoolLimit(): number | null {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return null;
  }

  try {
    const url = new URL(databaseUrl);
    const connectionLimit = url.searchParams.get("connection_limit");
    if (connectionLimit) {
      const parsed = Number.parseInt(connectionLimit, 10);
      return Number.isFinite(parsed) ? parsed : null;
    }
  } catch {
    return null;
  }

  return null;
}
