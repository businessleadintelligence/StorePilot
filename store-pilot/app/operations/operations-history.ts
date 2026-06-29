import type { OperationHistoryEvent, StoreOperation } from "./operations-types";

export function appendOperationHistory(input: {
  history: OperationHistoryEvent[];
  operation: StoreOperation;
  eventType: string;
  message: string;
  payload?: Record<string, unknown>;
}): OperationHistoryEvent[] {
  const event: OperationHistoryEvent = {
    id: `${input.operation.id}:${input.eventType}:${Date.now()}`,
    operationId: input.operation.id,
    eventType: input.eventType,
    message: input.message,
    at: new Date().toISOString(),
    payload: input.payload,
  };

  return [event, ...input.history].slice(0, 500);
}

export function historyForOperation(history: OperationHistoryEvent[], operationId: string) {
  return history.filter((event) => event.operationId === operationId);
}

export function summarizeHistory(history: OperationHistoryEvent[]) {
  return history.slice(0, 20);
}
