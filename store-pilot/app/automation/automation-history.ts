import type { AutomationHistoryEvent, AutomationStoreSnapshot, StoreAutomation } from "./automation-types";

export function appendAutomationHistory(input: {
  history: AutomationHistoryEvent[];
  automation: StoreAutomation;
  eventType: string;
  message: string;
  payload?: Record<string, unknown>;
}): AutomationHistoryEvent[] {
  const event: AutomationHistoryEvent = {
    id: `${input.automation.id}:${input.eventType}:${Date.now()}`,
    automationId: input.automation.id,
    eventType: input.eventType,
    message: input.message,
    at: new Date().toISOString(),
    payload: input.payload,
  };
  return [event, ...input.history].slice(0, 500);
}

export function historyForAutomation(history: AutomationHistoryEvent[], automationId: string) {
  return history.filter((event) => event.automationId === automationId);
}

export function summarizeAutomationHistory(snapshot: AutomationStoreSnapshot) {
  return snapshot.history.slice(0, 50);
}
