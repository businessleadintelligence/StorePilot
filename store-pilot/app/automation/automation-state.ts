import type { AutomationStatus } from "./automation-types";

const ALLOWED: Record<AutomationStatus, AutomationStatus[]> = {
  draft: ["prepared", "cancelled"],
  prepared: ["waiting_approval", "cancelled"],
  waiting_approval: ["approved", "prepared", "cancelled"],
  approved: ["executing", "cancelled"],
  executing: ["executed", "cancelled"],
  executed: ["verifying", "cancelled"],
  verifying: ["verified", "executed"],
  verified: ["archived"],
  archived: [],
  cancelled: [],
};

export function canTransitionAutomation(from: AutomationStatus, to: AutomationStatus): boolean {
  return ALLOWED[from].includes(to);
}

export function assertAutomationTransition(from: AutomationStatus, to: AutomationStatus): void {
  if (!canTransitionAutomation(from, to)) {
    throw new Error(`invalid_automation_transition:${from}->${to}`);
  }
}

export function timelineFieldForStatus(
  status: AutomationStatus,
): keyof import("./automation-types").AutomationTimeline | null {
  switch (status) {
    case "prepared":
      return "prepared";
    case "waiting_approval":
      return "waitingApproval";
    case "approved":
      return "approved";
    case "executing":
      return "executing";
    case "executed":
      return "executed";
    case "verifying":
      return "verifying";
    case "verified":
      return "verified";
    case "archived":
      return "archived";
    case "cancelled":
      return "cancelled";
    default:
      return null;
  }
}
