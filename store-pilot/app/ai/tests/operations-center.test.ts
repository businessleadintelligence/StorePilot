import { describe, expect, it, vi } from "vitest";

import { join } from "node:path";

import { AIRunner } from "../core/ai-runner";
import { ConsoleAILogger } from "../core/ai-logger";
import { loadAIConfig } from "../core/ai-config";
import { createFilePromptLoader } from "../prompts/file-prompt-loader";
import {
  OperationsCenter,
  deduplicateFindings,
} from "../orchestrator/operations-center";
import { FrameworkScheduler } from "../orchestrator/scheduler";
import { createExecutionPlan } from "../orchestrator/execution-plan";
import { createMockAIProvider } from "./helpers/mock-provider";
import { TemplateTestAgent } from "./helpers/template-test-agent";

describe("Operations center orchestration", () => {
  it("executes registered agents and builds a unified report", async () => {
    const provider = createMockAIProvider("mock-provider");
    const runner = new AIRunner({
      provider,
      config: loadAIConfig({
        provider: "mock-provider",
        model: "mock-model",
      }),
      logger: new ConsoleAILogger(),
      loadPrompt: createFilePromptLoader({
        promptsDirectory: join(process.cwd(), "app", "ai", "prompts"),
      }).load,
    });

    const center = new OperationsCenter({
      runner,
      scheduler: new FrameworkScheduler(),
    });

    const agent = new TemplateTestAgent({ provider });
    center.registerAgent({
      agent,
      extractFindings: (agentId, output) => [
        {
          id: `${agentId}-finding-1`,
          sourceAgentId: agentId,
          category: "inventory",
          title: output.recommendation,
          summary: output.reasoning,
          priority: output.priority,
          confidence: output.confidence,
          impact: output.impact,
        },
      ],
    });

    const plan = createExecutionPlan({
      id: "plan-1",
      storeId: "store-1",
      steps: [
        {
          agentId: agent.id,
          input: {
            storeId: "store-1",
            payload: {
              inventoryStatus: "LOW",
              productTitle: "Blue Hoodie",
            },
          },
        },
      ],
    });

    const scheduled = await center.schedulePlan(plan);
    expect(scheduled.planId).toBe("plan-1");

    const { report, execution } = await center.runAndReport(plan);
    expect(execution.agentResults).toHaveLength(1);
    expect(report.findings).toHaveLength(1);
    expect(report.totalEstimatedCostUsd).toBeGreaterThan(0);
  });

  it("deduplicates and prioritizes findings", () => {
    const findings = deduplicateFindings([
      {
        id: "1",
        sourceAgentId: "a",
        category: "inventory",
        title: "Restock SKU",
        summary: "Low stock",
        priority: 2,
        confidence: 0.7,
        impact: "high",
      },
      {
        id: "2",
        sourceAgentId: "b",
        category: "inventory",
        title: "Restock SKU",
        summary: "Low stock",
        priority: 5,
        confidence: 0.9,
        impact: "high",
      },
    ]);

    expect(findings).toHaveLength(1);

    const prioritized = new OperationsCenter({
      runner: {} as AIRunner,
      scheduler: new FrameworkScheduler(),
    }).prioritizeFindings(findings);

    expect(prioritized[0]?.priority).toBe(2);
  });

  it("records failed agents without stopping the plan", async () => {
    const provider = createMockAIProvider("mock-provider");
    const runner = new AIRunner({
      provider,
      config: loadAIConfig({
        provider: "mock-provider",
        model: "mock-model",
      }),
      logger: new ConsoleAILogger(),
      loadPrompt: vi.fn(async () => {
        throw new Error("missing prompt");
      }),
    });

    const center = new OperationsCenter({
      runner,
      scheduler: new FrameworkScheduler(),
    });

    center.registerAgent({ agent: new TemplateTestAgent({ provider }) });

    const execution = await center.executePlan(
      createExecutionPlan({
        id: "plan-fail",
        storeId: "store-1",
        steps: [
          {
            agentId: "template-test-agent",
            input: {
              storeId: "store-1",
              payload: {
                inventoryStatus: "LOW",
                productTitle: "Blue Hoodie",
              },
            },
          },
          {
            agentId: "missing-agent",
            input: {
              storeId: "store-1",
              payload: {},
            },
          },
        ],
      }),
    );

    expect(execution.failedAgentIds).toEqual([
      "template-test-agent",
      "missing-agent",
    ]);
  });
});
