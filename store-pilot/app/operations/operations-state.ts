import type { KanbanColumn, OperationStatus } from "./operations-types";

const STATUS_TO_KANBAN: Record<OperationStatus, KanbanColumn> = {
  pending: "planned",
  approved: "approved",
  in_progress: "in_progress",
  paused: "in_progress",
  blocked: "blocked",
  verification: "verification",
  completed: "completed",
  verified: "completed",
  archived: "completed",
};

const ALLOWED_TRANSITIONS: Record<OperationStatus, OperationStatus[]> = {
  pending: ["approved", "archived"],
  approved: ["in_progress", "archived"],
  in_progress: ["paused", "blocked", "verification", "completed"],
  paused: ["in_progress", "archived"],
  blocked: ["in_progress", "archived"],
  verification: ["completed", "verified", "in_progress"],
  completed: ["verified", "verification"],
  verified: ["archived"],
  archived: [],
};

export function mapStatusToKanbanColumn(status: OperationStatus): KanbanColumn {
  return STATUS_TO_KANBAN[status];
}

export function canTransitionOperation(from: OperationStatus, to: OperationStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertOperationTransition(from: OperationStatus, to: OperationStatus): void {
  if (!canTransitionOperation(from, to)) {
    throw new Error(`invalid_operation_transition:${from}->${to}`);
  }
}

export function nextStatusForAction(action: string): OperationStatus | null {
  switch (action) {
    case "approve":
      return "approved";
    case "start":
      return "in_progress";
    case "pause":
      return "paused";
    case "block":
      return "blocked";
    case "complete":
      return "verification";
    case "verify":
      return "verified";
    case "archive":
      return "archived";
    default:
      return null;
  }
}

export function timelineFieldForStatus(status: OperationStatus): keyof import("./operations-types").OperationTimeline | null {
  switch (status) {
    case "approved":
      return "approved";
    case "in_progress":
      return "started";
    case "paused":
      return "paused";
    case "completed":
    case "verification":
      return "completed";
    case "verified":
      return "verified";
    case "archived":
      return "archived";
    default:
      return null;
  }
}
