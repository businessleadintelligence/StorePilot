import { getLogContext } from "./context.server";
import {
  buildStructuredLogEntry,
  resolveMinimumLogLevel,
  shouldEmitLogLevel,
  writeStructuredLog,
} from "./format.server";
import type { Logger, LoggerBindings, LogContext, LogLevel } from "./types.server";

const DEFAULT_SERVICE = "store-pilot";

export type CreateLoggerOptions = {
  component: string;
  service?: string;
  bindings?: LoggerBindings;
};

function mergeBindings(
  runtimeContext: LogContext | undefined,
  bindings: LoggerBindings,
): LogContext {
  const asyncContext = getLogContext();

  return {
    ...asyncContext,
    ...bindings,
    ...runtimeContext,
  };
}

function emit(
  level: LogLevel,
  options: CreateLoggerOptions,
  message: string,
  context?: LogContext,
): void {
  if (!shouldEmitLogLevel(level, resolveMinimumLogLevel())) {
    return;
  }

  const mergedContext = mergeBindings(context, options.bindings ?? {});
  const entry = buildStructuredLogEntry({
    level,
    service: options.service ?? DEFAULT_SERVICE,
    component: options.component,
    message,
    context: mergedContext,
  });

  writeStructuredLog(entry);
}

export function createLogger(options: CreateLoggerOptions): Logger {
  const baseOptions: CreateLoggerOptions = {
    service: options.service ?? DEFAULT_SERVICE,
    component: options.component,
    bindings: options.bindings ?? {},
  };

  return {
    debug(message, context) {
      emit("debug", baseOptions, message, context);
    },
    info(message, context) {
      emit("info", baseOptions, message, context);
    },
    warn(message, context) {
      emit("warn", baseOptions, message, context);
    },
    error(message, context) {
      emit("error", baseOptions, message, context);
    },
    fatal(message, context) {
      emit("fatal", baseOptions, message, context);
    },
    child(bindings) {
      const nextComponent = bindings.component ?? baseOptions.component;
      const { component: _component, ...correlationBindings } = bindings;

      return createLogger({
        service: baseOptions.service,
        component: nextComponent,
        bindings: {
          ...baseOptions.bindings,
          ...correlationBindings,
        },
      });
    },
  };
}

export const rootLogger = createLogger({ component: "app" });
