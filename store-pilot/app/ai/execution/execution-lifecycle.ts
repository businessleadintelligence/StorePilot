export type ExecutionState =
  | "pending"
  | "running"
  | "retry"
  | "succeeded"
  | "failed"
  | "cached"
  | "skipped";

export type ExecutionTransition = {
  from: ExecutionState;
  to: ExecutionState;
  at: string;
  reason?: string;
};

export type ExecutionRecord = {
  id: string;
  storeId: string;
  merchantId?: string | null;
  agentId: string;
  subjectKey: string;
  state: ExecutionState;
  transitions: ExecutionTransition[];
  createdAt: string;
  updatedAt: string;
};

const ALLOWED_TRANSITIONS: Record<ExecutionState, ExecutionState[]> = {
  pending: ["running", "cached", "skipped", "failed"],
  running: ["retry", "succeeded", "failed", "skipped"],
  retry: ["running", "succeeded", "failed"],
  succeeded: [],
  failed: [],
  cached: [],
  skipped: [],
};

export function canTransition(from: ExecutionState, to: ExecutionState): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function transitionExecution(
  record: ExecutionRecord,
  to: ExecutionState,
  reason?: string,
): ExecutionRecord {
  if (!canTransition(record.state, to)) {
    throw new Error(`invalid_execution_transition:${record.state}->${to}`);
  }

  const at = new Date().toISOString();

  return {
    ...record,
    state: to,
    updatedAt: at,
    transitions: [
      ...record.transitions,
      {
        from: record.state,
        to,
        at,
        reason,
      },
    ],
  };
}

export function createExecutionRecord(input: {
  id: string;
  storeId: string;
  merchantId?: string | null;
  agentId: string;
  subjectKey: string;
}): ExecutionRecord {
  const now = new Date().toISOString();

  return {
    id: input.id,
    storeId: input.storeId,
    merchantId: input.merchantId ?? null,
    agentId: input.agentId,
    subjectKey: input.subjectKey,
    state: "pending",
    transitions: [],
    createdAt: now,
    updatedAt: now,
  };
}

export class ExecutionLifecycleTracker {
  private readonly records = new Map<string, ExecutionRecord>();

  start(input: {
    id: string;
    storeId: string;
    merchantId?: string | null;
    agentId: string;
    subjectKey: string;
  }): ExecutionRecord {
    const record = createExecutionRecord(input);
    this.records.set(record.id, record);
    return record;
  }

  get(id: string): ExecutionRecord | undefined {
    return this.records.get(id);
  }

  advance(id: string, to: ExecutionState, reason?: string): ExecutionRecord {
    const current = this.records.get(id);
    if (!current) {
      throw new Error(`execution_not_found:${id}`);
    }

    const next = transitionExecution(current, to, reason);
    this.records.set(id, next);
    return next;
  }
}
