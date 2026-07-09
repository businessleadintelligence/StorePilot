import { describe, expect, it, vi } from "vitest";

import { ConsoleAILogger, createExecutionLogEntry } from "../core/ai-logger";

describe("AI logging", () => {
  it("logs execution metadata without raw prompt content", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    const logger = new ConsoleAILogger();
    logger.logExecution(
      createExecutionLogEntry({
        agentId: "template-test-agent",
        provider: "mock-provider",
        model: "mock-model",
        promptId: "platform.template",
        promptVersion: "1.0.0",
        latencyMs: 12,
        estimatedCostUsd: 0.002,
        tokens: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
        },
        status: "success",
        validationStatus: "valid",
        operation: "agent_run_success",
      }),
    );

    const line = infoSpy.mock.calls[0]?.[0];
    expect(typeof line).toBe("string");
    const payload = JSON.stringify(JSON.parse(String(line)));
    expect(payload).toContain("platform.template");
    expect(payload).not.toContain("customer@example.com");
    expect(payload).toContain("estimatedCostUsd");
    expect(payload).toContain("aiRequestId");
  });
});
