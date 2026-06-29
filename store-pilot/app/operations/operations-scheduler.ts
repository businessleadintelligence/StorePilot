import type { MerchantLearningProfile, StoreOperation } from "./operations-types";

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function scheduleOperationForMerchant(input: {
  operation: StoreOperation;
  learning: MerchantLearningProfile;
  now?: Date;
}): StoreOperation {
  const now = input.now ?? new Date();
  let scheduled = startOfDay(now);

  if (input.learning.ignoresWeekends && isWeekend(scheduled)) {
    scheduled = addDays(scheduled, scheduled.getDay() === 0 ? 1 : 2);
  }

  if (input.learning.prefersEvenings) {
    scheduled.setHours(18, 0, 0, 0);
  } else {
    scheduled.setHours(10, 0, 0, 0);
  }

  return {
    ...input.operation,
    scheduledFor: scheduled.toISOString(),
    dueAt: addDays(scheduled, 3).toISOString(),
    updatedAt: now.toISOString(),
  };
}

export function bucketOperationsByCalendar(operations: StoreOperation[], now = new Date()) {
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);
  const weekEnd = addDays(today, 7);

  const bucket = {
    today: [] as StoreOperation[],
    tomorrow: [] as StoreOperation[],
    thisWeek: [] as StoreOperation[],
    later: [] as StoreOperation[],
  };

  for (const operation of operations) {
    const scheduled = operation.scheduledFor ? new Date(operation.scheduledFor) : new Date(operation.createdAt);
    if (scheduled < addDays(today, 1)) bucket.today.push(operation);
    else if (scheduled < addDays(tomorrow, 1)) bucket.tomorrow.push(operation);
    else if (scheduled < weekEnd) bucket.thisWeek.push(operation);
    else bucket.later.push(operation);
  }

  return bucket;
}

export function findOverdueOperations(operations: StoreOperation[], now = new Date()): StoreOperation[] {
  return operations.filter(
    (operation) =>
      operation.dueAt &&
      new Date(operation.dueAt) < now &&
      !["completed", "verified", "archived"].includes(operation.status),
  );
}
