import {
  createLogger,
  isSensitiveLogKey,
  sanitizeLogContextDeep,
} from "./logging/index.server";

export { isSensitiveLogKey, sanitizeLogContextDeep };

export function createSafeLogger(prefix: string) {
  const component = prefix.replace(/^\[|\]$/g, "").trim() || "app";
  const logger = createLogger({ component });

  return {
    debug(message: string, context: Record<string, unknown> = {}): void {
      logger.debug(message, context);
    },
    info(message: string, context: Record<string, unknown> = {}): void {
      logger.info(message, context);
    },
    warn(message: string, context: Record<string, unknown> = {}): void {
      logger.warn(message, context);
    },
    error(message: string, context: Record<string, unknown> = {}): void {
      logger.error(message, context);
    },
    fatal(message: string, context: Record<string, unknown> = {}): void {
      logger.fatal(message, context);
    },
  };
}
