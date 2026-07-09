import { randomUUID } from "node:crypto";

const ID_PREFIX = {
  correlation: "corr",
  worker: "worker",
  cron: "cron",
  webhook: "wh",
  ai: "ai",
  database: "db",
} as const;

function createPrefixedId(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

export function generateCorrelationId(): string {
  return createPrefixedId(ID_PREFIX.correlation);
}

export function createWorkerId(suffix?: string | number): string {
  const base = createPrefixedId(ID_PREFIX.worker);
  return suffix === undefined ? base : `${base}-${suffix}`;
}

export function createCronId(): string {
  return createPrefixedId(ID_PREFIX.cron);
}

export function createWebhookLogId(webhookId?: string): string {
  if (webhookId?.trim()) {
    return `${ID_PREFIX.webhook}-${webhookId.trim()}`;
  }

  return createPrefixedId(ID_PREFIX.webhook);
}

export function generateAiRequestId(): string {
  return createPrefixedId(ID_PREFIX.ai);
}

export function generateDatabaseRequestId(): string {
  return createPrefixedId(ID_PREFIX.database);
}
