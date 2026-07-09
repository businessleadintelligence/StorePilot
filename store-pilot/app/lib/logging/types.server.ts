export const LOG_LEVELS = ["debug", "info", "warn", "error", "fatal"] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

export type CorrelationIds = {
  correlationId?: string;
  shopifyRequestId?: string;
  workerId?: string;
  cronId?: string;
  webhookId?: string;
  aiRequestId?: string;
  databaseRequestId?: string;
};

export type LogContext = Record<string, unknown> & Partial<CorrelationIds>;

export type StructuredLogEntry = {
  timestamp: string;
  level: LogLevel;
  service: string;
  component: string;
  message: string;
  environment: string;
  correlationId?: string;
  shopifyRequestId?: string;
  workerId?: string;
  cronId?: string;
  webhookId?: string;
  aiRequestId?: string;
  databaseRequestId?: string;
  [key: string]: unknown;
};

export type LoggerBindings = Partial<CorrelationIds> & {
  component?: string;
};

export type Logger = {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  fatal(message: string, context?: LogContext): void;
  child(bindings: LoggerBindings): Logger;
};
