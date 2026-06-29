import type { z } from "zod";

import type { AIAgent } from "../core/ai-agent";
import type { AIRunner } from "../core/ai-runner";
import type { AgentRunResult, UnifiedFinding, UnifiedReport } from "../core/ai-types";
import {
  createExecutionPlan,
  sortPlanSteps,
  type ExecutionPlan,
  type ExecutionPlanResult,
} from "./execution-plan";
import type { AIScheduler } from "./scheduler";

export type FindingExtractor<TOutput> = (
  agentId: string,
  output: TOutput,
) => UnifiedFinding[];

export type RegisteredAgent = {
  agent: AIAgent<unknown, z.ZodTypeAny>;
  extractFindings?: FindingExtractor<unknown>;
};

export type OperationsCenterDependencies = {
  runner: AIRunner;
  scheduler: AIScheduler;
};

export class OperationsCenter {
  private readonly agents = new Map<string, RegisteredAgent>();

  constructor(private readonly dependencies: OperationsCenterDependencies) {}

  registerAgent<TInput, TSchema extends z.ZodTypeAny>(
    registration: {
      agent: AIAgent<TInput, TSchema>;
      extractFindings?: FindingExtractor<z.infer<TSchema>>;
    },
  ): void {
    this.agents.set(registration.agent.id, {
      agent: registration.agent as AIAgent<unknown, z.ZodTypeAny>,
      extractFindings: registration.extractFindings as FindingExtractor<unknown> | undefined,
    });
  }

  getAgent(agentId: string): RegisteredAgent | undefined {
    return this.agents.get(agentId);
  }

  async schedulePlan(plan: ExecutionPlan, runAt?: string) {
    return this.dependencies.scheduler.schedule({ plan, runAt });
  }

  async executePlan(plan: ExecutionPlan): Promise<ExecutionPlanResult> {
    const startedAt = new Date().toISOString();
    const agentResults: AgentRunResult<unknown>[] = [];
    const failedAgentIds: string[] = [];

    for (const step of sortPlanSteps(plan.steps)) {
      const registration = this.agents.get(step.agentId);
      if (!registration) {
        failedAgentIds.push(step.agentId);
        continue;
      }

      try {
        const result = await this.dependencies.runner.runAgent(registration.agent, {
          storeId: step.input.storeId,
          input: step.input.payload,
          metadata: step.input.metadata,
        });
        agentResults.push(result);
      } catch {
        failedAgentIds.push(step.agentId);
      }
    }

    return {
      planId: plan.id,
      storeId: plan.storeId,
      startedAt,
      completedAt: new Date().toISOString(),
      agentResults,
      failedAgentIds,
    };
  }

  mergeFindings(findings: UnifiedFinding[]): UnifiedFinding[] {
    return deduplicateFindings(findings);
  }

  prioritizeFindings(findings: UnifiedFinding[]): UnifiedFinding[] {
    return [...findings].sort((left, right) => {
      if (right.priority !== left.priority) {
        return right.priority - left.priority;
      }

      if (right.confidence !== left.confidence) {
        return right.confidence - left.confidence;
      }

      return left.title.localeCompare(right.title);
    });
  }

  buildUnifiedReport(input: {
    storeId: string;
    plan: ExecutionPlan;
    execution: ExecutionPlanResult;
  }): UnifiedReport {
    const findings: UnifiedFinding[] = [];

    for (const result of input.execution.agentResults) {
      const registration = this.agents.get(result.agentId);
      if (!registration?.extractFindings) {
        continue;
      }

      findings.push(...registration.extractFindings(result.agentId, result.output));
    }

    const merged = this.prioritizeFindings(this.mergeFindings(findings));

    return {
      storeId: input.storeId,
      generatedAt: new Date().toISOString(),
      findings: merged,
      agentsExecuted: input.execution.agentResults.map((result) => result.agentId),
      totalLatencyMs: input.execution.agentResults.reduce(
        (total, result) => total + result.latencyMs,
        0,
      ),
      totalEstimatedCostUsd: input.execution.agentResults.reduce(
        (total, result) => total + (result.estimatedCostUsd ?? 0),
        0,
      ),
    };
  }

  async runAndReport(planInput: {
    id: string;
    storeId: string;
    steps: ExecutionPlan["steps"];
  }): Promise<{ execution: ExecutionPlanResult; report: UnifiedReport }> {
    const plan = createExecutionPlan(planInput);
    const execution = await this.executePlan(plan);
    const report = this.buildUnifiedReport({
      storeId: plan.storeId,
      plan,
      execution,
    });

    return { execution, report };
  }
}

export function deduplicateFindings(findings: UnifiedFinding[]): UnifiedFinding[] {
  const seen = new Set<string>();
  const unique: UnifiedFinding[] = [];

  for (const finding of findings) {
    const key = `${finding.category}:${finding.title}:${finding.summary}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(finding);
  }

  return unique;
}
