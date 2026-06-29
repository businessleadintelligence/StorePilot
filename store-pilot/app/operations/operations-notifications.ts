import type { OperationNotification, StoreOperation } from "./operations-types";

export function buildOperationNotification(input: {
  operation: StoreOperation;
  type: string;
  title: string;
  message: string;
}): OperationNotification {
  return {
    id: `${input.operation.id}:${input.type}:${Date.now()}`,
    operationId: input.operation.id,
    type: input.type,
    title: input.title,
    message: input.message,
    at: new Date().toISOString(),
    read: false,
  };
}

export function notificationForStatusChange(input: {
  operation: StoreOperation;
  fromStatus: StoreOperation["status"];
  toStatus: StoreOperation["status"];
}): OperationNotification | null {
  if (input.toStatus === "approved") {
    return buildOperationNotification({
      operation: input.operation,
      type: "operation_approved",
      title: "Operation approved",
      message: `${input.operation.title} is ready to start.`,
    });
  }
  if (input.toStatus === "in_progress") {
    return buildOperationNotification({
      operation: input.operation,
      type: "operation_started",
      title: "Operation started",
      message: `${input.operation.title} is now in progress.`,
    });
  }
  if (input.toStatus === "blocked") {
    return buildOperationNotification({
      operation: input.operation,
      type: "operation_blocked",
      title: "Operation blocked",
      message: input.operation.blockedReason ?? `${input.operation.title} is blocked.`,
    });
  }
  if (input.toStatus === "verified") {
    return buildOperationNotification({
      operation: input.operation,
      type: "verification_passed",
      title: "Verification passed",
      message: `${input.operation.title} has been verified.`,
    });
  }
  if (input.operation.verificationStatus === "failed") {
    return buildOperationNotification({
      operation: input.operation,
      type: "verification_failed",
      title: "Verification failed",
      message: `${input.operation.title} needs another review.`,
    });
  }
  return null;
}

export function findOverdueNotifications(operations: StoreOperation[]): OperationNotification[] {
  const now = Date.now();
  return operations
    .filter(
      (operation) =>
        operation.dueAt &&
        new Date(operation.dueAt).getTime() < now &&
        !["completed", "verified", "archived"].includes(operation.status),
    )
    .map((operation) =>
      buildOperationNotification({
        operation,
        type: "operation_overdue",
        title: "Operation overdue",
        message: `${operation.title} is past its due date.`,
      }),
    );
}
