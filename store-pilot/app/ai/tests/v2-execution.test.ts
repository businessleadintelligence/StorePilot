import { describe, expect, it } from "vitest";

import {
  canTransition,
  createExecutionRecord,
  transitionExecution,
} from "../execution/execution-lifecycle";

describe("Execution lifecycle", () => {
  it("allows valid state transitions", () => {
    expect(canTransition("pending", "running")).toBe(true);
    expect(canTransition("running", "retry")).toBe(true);
    expect(canTransition("retry", "running")).toBe(true);
    expect(canTransition("running", "succeeded")).toBe(true);
  });

  it("rejects invalid transitions", () => {
    expect(canTransition("succeeded", "running")).toBe(false);
    expect(canTransition("failed", "retry")).toBe(false);
  });

  it("records transition history", () => {
    let record = createExecutionRecord({
      id: "exec-1",
      storeId: "store-1",
      agentId: "platform_template",
      subjectKey: "product:1",
    });

    record = transitionExecution(record, "running");
    record = transitionExecution(record, "succeeded");

    expect(record.state).toBe("succeeded");
    expect(record.transitions).toHaveLength(2);
  });
});
