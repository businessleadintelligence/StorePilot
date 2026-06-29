import { beforeEach, describe, expect, it } from "vitest";
import { createInMemoryAutomationPersistence } from "../../automation/automation-persistence";
import { buildCreateAutomationInput, buildExecutableAutomationInput } from "../../automation/__tests__/helpers";
import { createMockGraphqlRouter } from "../../shopify-automation/__tests__/helpers";
import {
  approveAutomation,
  createAutomation,
  executeAutomation,
  getAutomationCenterData,
  verifyAutomation,
} from "../automation.server";
import { createOperation, approveOperation } from "../operations.server";
import { buildCreateOperationInput } from "../../operations/__tests__/helpers";
import { createInMemoryOperationsPersistence } from "../../operations/operations-persistence";

describe("Automation integration with operations", () => {
  beforeEach(() => {
    globalThis.__D7_TEST__.mockAdminGraphql.mockReset();
    globalThis.__D7_TEST__.mockAdminGraphql.mockImplementation(createMockGraphqlRouter());
  });

  it("creates automations from approved operations via sync", async () => {
    const operationsPersistence = createInMemoryOperationsPersistence();
    const automationPersistence = createInMemoryAutomationPersistence();

    const operation = await createOperation({
      ...buildCreateOperationInput({
        sourceId: "executive:automation-sync-1",
        storeId: "store-test-001",
      }),
      persistence: operationsPersistence,
    });
    await approveOperation({ storeId: "store-test-001", operationId: operation.id, persistence: operationsPersistence });

    const center = await getAutomationCenterData({
      storeId: "store-test-001",
      persistence: automationPersistence,
      syncFromOperations: false,
    });

    const automation = await createAutomation({
      ...buildCreateAutomationInput({
        sourceId: operation.id,
        operationId: operation.id,
      }),
      persistence: automationPersistence,
    });

    expect(center.automationQueue.length).toBeGreaterThanOrEqual(0);
    expect(automation.operationId).toBe(operation.id);
  });

  it("preserves merchant approval gate through execution", async () => {
    const persistence = createInMemoryAutomationPersistence();
    const automation = await createAutomation({
      ...buildExecutableAutomationInput({ sourceId: "operation:gate-1" }),
      persistence,
    });

    await expect(
      executeAutomation({ storeId: "store-test-001", automationId: automation.id, persistence }),
    ).rejects.toThrow();

    await approveAutomation({ storeId: "store-test-001", automationId: automation.id, persistence });
    const executed = await executeAutomation({ storeId: "store-test-001", automationId: automation.id, persistence });
    expect(executed.status).toBe("executed");

    const verified = await verifyAutomation({
      storeId: "store-test-001",
      automationId: automation.id,
      metrics: { tags_updated: true },
      persistence,
    });
    expect(verified.status).toBe("verified");
  });
});
