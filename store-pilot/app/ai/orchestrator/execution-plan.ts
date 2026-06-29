import type { AgentRunResult } from "../core/ai-types";

export type ExecutionPlanStep = {
  agentId: string;
  input: {
    storeId: string;
    payload: unknown;
    metadata?: Record<string, string>;
  };
  priority?: number;
};

export type ExecutionPlan = {
  id: string;
  storeId: string;
  steps: ExecutionPlanStep[];
  metadata?: Record<string, string>;
};

export type ExecutionPlanResult = {
  planId: string;
  storeId: string;
  startedAt: string;
  completedAt: string;
  agentResults: AgentRunResult<unknown>[];
  failedAgentIds: string[];
};

export function createExecutionPlan(input: {
  id: string;
  storeId: string;
  steps: ExecutionPlanStep[];
  metadata?: Record<string, string>;
}): ExecutionPlan {
  return {
    id: input.id,
    storeId: input.storeId,
    steps: input.steps,
    metadata: input.metadata,
  };
}

export function sortPlanSteps(steps: ExecutionPlanStep[]): ExecutionPlanStep[] {
  return [...steps].sort((left, right) => (right.priority ?? 0) - (left.priority ?? 0));
}
