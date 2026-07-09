import type { OperationStatus, StoreOperation , CreateOperationInput } from "../operations/operations-types";
import {
  createInMemoryOperationsPersistence,
  loadOperationsSnapshot,
  saveOperationsSnapshot,
  upsertOperationInSnapshot,
  type OperationsPersistence,
} from "../operations/operations-persistence";
import {
  buildOperationsCenterData,
  createOperationRecordForStore,
  syncOperationsFromExecutiveDecisions,
} from "../operations/operations-engine";
import { loadLatestCollaborationOutputFromStore } from "./collaboration.server";
import {
  assertOperationTransition,
  mapStatusToKanbanColumn,
  timelineFieldForStatus,
} from "../operations/operations-state";
import { validateOperationTransition, validateVerificationComplete } from "../operations/operations-validator";
import { canCompleteOperation, canVerifyOperation, markVerificationFromMetrics } from "../operations/operations-verification";
import { refreshOperationProgress } from "../operations/operations-progress";
import { appendOperationHistory } from "../operations/operations-history";
import { notificationForStatusChange } from "../operations/operations-notifications";
import { updateMerchantLearningProfile } from "../operations/operations-metrics";

export type {
  CreateOperationInput,
  OperationsCenterData,
  StoreOperation,
} from "../operations/operations-types";

function getPersistence(persistence?: OperationsPersistence) {
  return persistence ?? createInMemoryOperationsPersistence();
}

async function updateOperationStatus(input: {
  storeId: string;
  operationId: string;
  toStatus: OperationStatus;
  persistence?: OperationsPersistence;
  blockedReason?: string | null;
  verificationMetrics?: Record<string, number | boolean | string>;
}): Promise<StoreOperation> {
  const persistence = getPersistence(input.persistence);
  const snapshot = await loadOperationsSnapshot(input.storeId, persistence);
  const operation = snapshot.operations.find((item) => item.id === input.operationId);
  if (!operation) throw new Error("operation_not_found");

  validateOperationTransition({ operation, toStatus: input.toStatus });
  assertOperationTransition(operation.status, input.toStatus);

  const now = new Date().toISOString();
  const timelineField = timelineFieldForStatus(input.toStatus);
  let updated: StoreOperation = {
    ...operation,
    status: input.toStatus,
    kanbanColumn: mapStatusToKanbanColumn(input.toStatus),
    blockedReason: input.toStatus === "blocked" ? input.blockedReason ?? "Blocked by merchant" : null,
    updatedAt: now,
    timeline: {
      ...operation.timeline,
      ...(timelineField ? { [timelineField]: now } : {}),
    },
  };

  if (input.toStatus === "in_progress" && !updated.startedAt) updated.startedAt = now;
  if (input.toStatus === "verification" || input.toStatus === "completed") {
    if (!canCompleteOperation(updated)) throw new Error("tasks_incomplete");
    updated.completedAt = now;
    updated = refreshOperationProgress(updated);
  }
  if (input.toStatus === "verified") {
    if (input.verificationMetrics) {
      updated = markVerificationFromMetrics(updated, input.verificationMetrics);
    }
    validateVerificationComplete(updated);
    if (!canVerifyOperation(updated)) throw new Error("verification_incomplete");
    updated.verifiedAt = now;
    updated.verificationStatus = "passed";
  }
  if (input.toStatus === "archived") updated.archivedAt = now;

  const history = appendOperationHistory({
    history: snapshot.history,
    operation: updated,
    eventType: `status_${input.toStatus}`,
    message: `Operation moved to ${input.toStatus}`,
  });

  const notification = notificationForStatusChange({
    operation: updated,
    fromStatus: operation.status,
    toStatus: input.toStatus,
  });

  if (input.toStatus === "verified" && updated.completedAt && updated.startedAt) {
    snapshot.learning = updateMerchantLearningProfile({
      learning: snapshot.learning,
      operation: updated,
      completionMinutes:
        (new Date(updated.completedAt).getTime() - new Date(updated.startedAt).getTime()) / 60000,
    });
  }

  await saveOperationsSnapshot(
    input.storeId,
    upsertOperationInSnapshot({
      snapshot: { ...snapshot, history, learning: snapshot.learning },
      operation: updated,
      notification: notification ?? undefined,
    }),
    persistence,
  );

  return updated;
}

export async function createOperation(
  input: CreateOperationInput & { persistence?: OperationsPersistence },
): Promise<StoreOperation> {
  return createOperationRecordForStore({
    createInput: input,
    persistence: input.persistence,
  });
}

export async function approveOperation(input: {
  storeId: string;
  operationId: string;
  persistence?: OperationsPersistence;
}) {
  return updateOperationStatus({ ...input, toStatus: "approved" });
}

export async function startOperation(input: {
  storeId: string;
  operationId: string;
  persistence?: OperationsPersistence;
}) {
  return updateOperationStatus({ ...input, toStatus: "in_progress" });
}

export async function pauseOperation(input: {
  storeId: string;
  operationId: string;
  persistence?: OperationsPersistence;
}) {
  return updateOperationStatus({ ...input, toStatus: "paused" });
}

export async function completeOperation(input: {
  storeId: string;
  operationId: string;
  persistence?: OperationsPersistence;
}) {
  const persistence = getPersistence(input.persistence);
  const snapshot = await loadOperationsSnapshot(input.storeId, persistence);
  const operation = snapshot.operations.find((item) => item.id === input.operationId);
  if (!operation) throw new Error("operation_not_found");

  const completedTasks = operation.tasks.map((task) => ({
    ...task,
    completed: true,
    completedAt: task.completedAt ?? new Date().toISOString(),
  }));

  await saveOperationsSnapshot(
    input.storeId,
    upsertOperationInSnapshot({
      snapshot,
      operation: refreshOperationProgress({ ...operation, tasks: completedTasks }),
    }),
    persistence,
  );

  return updateOperationStatus({ ...input, toStatus: "verification", persistence });
}

export async function verifyOperation(input: {
  storeId: string;
  operationId: string;
  metrics?: Record<string, number | boolean | string>;
  persistence?: OperationsPersistence;
}) {
  return updateOperationStatus({
    ...input,
    toStatus: "verified",
    verificationMetrics: input.metrics ?? { primary_outcome: 1, bundle_published: true },
  });
}

export async function archiveOperation(input: {
  storeId: string;
  operationId: string;
  persistence?: OperationsPersistence;
}) {
  return updateOperationStatus({ ...input, toStatus: "archived" });
}

export async function listOperations(input: {
  storeId: string;
  persistence?: OperationsPersistence;
}) {
  const snapshot = await loadOperationsSnapshot(input.storeId, getPersistence(input.persistence));
  return snapshot.operations.filter((operation) => operation.status !== "archived");
}

export async function getOperationsCenterData(input: {
  storeId: string;
  persistence?: OperationsPersistence;
  syncFromCollaboration?: boolean;
}) {
  const persistence = getPersistence(input.persistence);

  if (input.syncFromCollaboration !== false) {
    const collaboration = await loadLatestCollaborationOutputFromStore({ storeId: input.storeId });
    if (collaboration?.executiveActions?.length) {
      await syncOperationsFromExecutiveDecisions({
        storeId: input.storeId,
        executiveActions: collaboration.executiveActions,
        persistence,
      });
    }
  }

  return buildOperationsCenterData({ storeId: input.storeId, persistence });
}

export function serializeOperationsCenterForLoader<T>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T;
}

export {
  createInMemoryOperationsPersistence,
} from "../operations/operations-persistence";
