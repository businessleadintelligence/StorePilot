import { AsyncLocalStorage } from "node:async_hooks";

import type { CorrelationIds } from "./types.server";
import { generateCorrelationId } from "./ids.server";

const logContextStorage = new AsyncLocalStorage<CorrelationIds>();

export function getLogContext(): CorrelationIds {
  return logContextStorage.getStore() ?? {};
}

export function runWithLogContext<T>(context: CorrelationIds, fn: () => T): T {
  const parent = getLogContext();
  return logContextStorage.run({ ...parent, ...context }, fn);
}

export function withLogContext<T>(partial: Partial<CorrelationIds>, fn: () => T): T {
  const parent = getLogContext();
  return logContextStorage.run({ ...parent, ...partial }, fn);
}

export function extractRequestCorrelationIds(request: Request): CorrelationIds {
  const shopifyRequestId =
    request.headers.get("x-shopify-request-id") ??
    request.headers.get("x-request-id") ??
    undefined;

  const webhookId = request.headers.get("x-shopify-webhook-id") ?? undefined;

  const incomingCorrelationId = request.headers.get("x-correlation-id") ?? undefined;

  return {
    correlationId: incomingCorrelationId ?? generateCorrelationId(),
    ...(shopifyRequestId ? { shopifyRequestId } : {}),
    ...(webhookId ? { webhookId } : {}),
  };
}

export function createRequestLogContext(request: Request): CorrelationIds {
  return extractRequestCorrelationIds(request);
}
