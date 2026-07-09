import type { LogLevel, StructuredLogEntry } from "./types.server";
import { redactLogContext } from "./redaction.server";

const LOG_LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  fatal: 50,
};

export function resolveMinimumLogLevel(
  env: NodeJS.ProcessEnv = process.env,
): LogLevel {
  const configured = env.LOG_LEVEL?.trim().toLowerCase();

  if (
    configured === "debug" ||
    configured === "info" ||
    configured === "warn" ||
    configured === "error" ||
    configured === "fatal"
  ) {
    return configured;
  }

  return env.NODE_ENV === "production" ? "info" : "debug";
}

export function shouldEmitLogLevel(
  level: LogLevel,
  minimumLevel: LogLevel = resolveMinimumLogLevel(),
): boolean {
  return LOG_LEVEL_RANK[level] >= LOG_LEVEL_RANK[minimumLevel];
}

export function formatStructuredLogEntry(entry: StructuredLogEntry): string {
  return JSON.stringify(entry);
}

export function buildStructuredLogEntry(input: {
  level: LogLevel;
  service: string;
  component: string;
  message: string;
  context?: Record<string, unknown>;
  environment?: string;
}): StructuredLogEntry {
  const environment = input.environment ?? process.env.NODE_ENV ?? "development";
  const redactedContext = redactLogContext(input.context ?? {});

  const {
    correlationId,
    shopifyRequestId,
    workerId,
    cronId,
    webhookId,
    aiRequestId,
    databaseRequestId,
    ...remainingContext
  } = redactedContext;

  return {
    timestamp: new Date().toISOString(),
    level: input.level,
    service: input.service,
    component: input.component,
    message: input.message,
    environment,
    ...(typeof correlationId === "string" ? { correlationId } : {}),
    ...(typeof shopifyRequestId === "string" ? { shopifyRequestId } : {}),
    ...(typeof workerId === "string" ? { workerId } : {}),
    ...(typeof cronId === "string" ? { cronId } : {}),
    ...(typeof webhookId === "string" ? { webhookId } : {}),
    ...(typeof aiRequestId === "string" ? { aiRequestId } : {}),
    ...(typeof databaseRequestId === "string" ? { databaseRequestId } : {}),
    ...remainingContext,
  };
}

export function writeStructuredLog(
  entry: StructuredLogEntry,
  writeFn: (line: string) => void = defaultWriteFn(entry.level),
): void {
  writeFn(formatStructuredLogEntry(entry));
}

function defaultWriteFn(level: LogLevel): (line: string) => void {
  if (level === "warn") {
    return (line) => console.warn(line);
  }

  if (level === "error" || level === "fatal") {
    return (line) => console.error(line);
  }

  return (line) => console.info(line);
}
