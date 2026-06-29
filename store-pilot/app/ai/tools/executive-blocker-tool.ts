export type ExecutiveBlocker = {
  id: string;
  title: string;
  type: "operation" | "dependency" | "conflict" | "capacity";
  reason: string;
  severity: "low" | "medium" | "high";
  blockedTaskIds: string[];
};

export function identifyBlockedTasks(input: {
  operations: Array<{
    id: string;
    title: string;
    status: string;
    blockedReason: string | null;
  }>;
  dependencyBlockedIds: string[];
  conflictBlockedIds: string[];
  capacityBlocked: boolean;
}): {
  blockers: ExecutiveBlocker[];
  blockedTaskCount: number;
  criticalBlockerCount: number;
  issues: string[];
} {
  const issues: string[] = [];
  const blockers: ExecutiveBlocker[] = [];

  for (const operation of input.operations) {
    if (operation.status !== "blocked") continue;
    blockers.push({
      id: `blocker-op-${operation.id}`,
      title: operation.title,
      type: "operation",
      reason: operation.blockedReason ?? "Operation is blocked.",
      severity: "high",
      blockedTaskIds: [operation.id],
    });
  }

  for (const taskId of input.dependencyBlockedIds) {
    blockers.push({
      id: `blocker-dep-${taskId}`,
      title: `Dependency blocker for ${taskId}`,
      type: "dependency",
      reason: "Prerequisite work is incomplete.",
      severity: "medium",
      blockedTaskIds: [taskId],
    });
  }

  for (const taskId of input.conflictBlockedIds) {
    blockers.push({
      id: `blocker-conflict-${taskId}`,
      title: `Conflict blocker for ${taskId}`,
      type: "conflict",
      reason: "Competing priorities must be resolved first.",
      severity: "medium",
      blockedTaskIds: [taskId],
    });
  }

  if (input.capacityBlocked) {
    blockers.push({
      id: "blocker-capacity",
      title: "Merchant capacity exhausted",
      type: "capacity",
      reason: "Too many active workstreams for current merchant capacity.",
      severity: "high",
      blockedTaskIds: [],
    });
  }

  const blockedTaskCount = new Set(blockers.flatMap((blocker) => blocker.blockedTaskIds)).size;
  const criticalBlockerCount = blockers.filter((blocker) => blocker.severity === "high").length;

  if (criticalBlockerCount > 0) issues.push("critical_blockers_present");

  return { blockers, blockedTaskCount, criticalBlockerCount, issues };
}
