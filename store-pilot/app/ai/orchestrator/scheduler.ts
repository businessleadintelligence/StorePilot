import type { ExecutionPlan } from "./execution-plan";

export type ScheduleHandle = {
  id: string;
  planId: string;
  scheduledFor: string;
};

export type ScheduleRequest = {
  plan: ExecutionPlan;
  runAt?: string;
};

export interface AIScheduler {
  schedule(request: ScheduleRequest): Promise<ScheduleHandle>;
  cancel(handleId: string): Promise<void>;
  listPending(): Promise<ScheduleHandle[]>;
}

export class FrameworkScheduler implements AIScheduler {
  private readonly pending = new Map<string, ScheduleHandle>();

  async schedule(request: ScheduleRequest): Promise<ScheduleHandle> {
    const handle: ScheduleHandle = {
      id: crypto.randomUUID(),
      planId: request.plan.id,
      scheduledFor: request.runAt ?? new Date().toISOString(),
    };

    this.pending.set(handle.id, handle);
    return handle;
  }

  async cancel(handleId: string): Promise<void> {
    this.pending.delete(handleId);
  }

  async listPending(): Promise<ScheduleHandle[]> {
    return [...this.pending.values()].sort((left, right) =>
      left.scheduledFor.localeCompare(right.scheduledFor),
    );
  }
}
