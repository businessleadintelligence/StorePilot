import type { CollaborationMemoryState } from "./collaboration-types";

export function filterImplementedExecutiveActions<T extends { id: string }>(
  actions: T[],
  memory: CollaborationMemoryState,
): T[] {
  return actions.filter((action) => !memory.implementedExecutiveIds.has(action.id));
}

export function filterDismissedExecutiveActions<T extends { id: string }>(
  actions: T[],
  memory: CollaborationMemoryState,
): T[] {
  return actions.filter((action) => !memory.dismissedExecutiveIds.has(action.id));
}

export function applyCollaborationMemory<T extends { id: string; priority: number }>(
  actions: T[],
  memory: CollaborationMemoryState,
): T[] {
  return filterDismissedExecutiveActions(filterImplementedExecutiveActions(actions, memory), memory).map(
    (action) => ({
      ...action,
      priority: memory.dismissedExecutiveIds.has(action.id)
        ? Math.min(5, action.priority + 1)
        : action.priority,
    }),
  );
}
