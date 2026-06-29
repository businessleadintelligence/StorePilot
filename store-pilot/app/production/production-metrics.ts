import { createInMemoryAutomationPersistence } from "../automation/automation-persistence";
import { getAutomationCenterData } from "../services/automation.server";
import { getOperationsCenterData } from "../services/operations.server";
import { createInMemoryOperationsPersistence } from "../operations/operations-persistence";
import { buildSubsystemHealth } from "./production-checks";
import type { ProductionSubsystemHealth } from "./production-types";

const automationPersistence = createInMemoryAutomationPersistence();
const operationsPersistence = createInMemoryOperationsPersistence();

export async function monitorAutomationHealth(storeId: string): Promise<ProductionSubsystemHealth> {
  const center = await getAutomationCenterData({
    storeId,
    persistence: automationPersistence,
    syncFromOperations: false,
  });

  const failedCount = center.automationHistory.filter((event) =>
    event.eventType.includes("cancelled"),
  ).length;
  const verificationQueue = center.verificationQueue.length;
  const waitingApproval = center.pendingApprovals.length;

  const level =
    verificationQueue > 3
      ? "warning"
      : waitingApproval > 10
        ? "warning"
        : "healthy";

  return buildSubsystemHealth({
    id: "automation",
    label: "Automation",
    level,
    failureCount: failedCount,
    recoverySuggestion:
      verificationQueue > 0
        ? "Review automations awaiting verification"
        : waitingApproval > 0
          ? "Clear automation approval backlog"
          : null,
    details: {
      prepared: center.metrics.automationsPrepared,
      approved: center.metrics.automationsApproved,
      executionRate: center.metrics.executionRate,
      verificationRate: center.metrics.verificationRate,
      waitingApproval,
      verificationQueue,
      queueLength: center.automationQueue.length,
    },
  });
}

export async function monitorOperationsHealth(storeId: string): Promise<ProductionSubsystemHealth> {
  const center = await getOperationsCenterData({
    storeId,
    persistence: operationsPersistence,
    syncFromCollaboration: false,
  });

  const blocked = center.queue.filter((item) => item.status === "blocked").length;
  const verificationQueue = center.verificationQueue.length;
  const inboxCount = Object.values(center.inbox).reduce((sum, items) => sum + items.length, 0);
  const level =
    blocked > 0 ? "critical" : verificationQueue > 5 ? "warning" : "healthy";

  return buildSubsystemHealth({
    id: "operations",
    label: "Operations",
    level,
    failureCount: blocked,
    recoverySuggestion:
      blocked > 0
        ? "Resolve blocked operations in Operations Center"
        : verificationQueue > 0
          ? "Complete operations verification queue"
          : null,
    details: {
      inbox: inboxCount,
      queue: center.queue.length,
      blocked,
      completionRate: center.metrics.completionRate,
      verificationSuccessRate: center.metrics.verificationSuccessRate,
      verificationQueue,
    },
  });
}
