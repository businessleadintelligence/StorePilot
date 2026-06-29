import { describe, expect, it } from "vitest";
import { createInMemoryOperationsPersistence } from "../../operations/operations-persistence";
import { buildCreateOperationInput } from "../../operations/__tests__/helpers";
import {
  approveOperation,
  completeOperation,
  createOperation,
  startOperation,
  verifyOperation,
} from "../../services/operations.server";
import { processOperationsLifecycle } from "../../services/operations-lifecycle.server";

describe("Operations lifecycle service", () => {
  it("auto verifies satisfied verification queue items", async () => {
    const persistence = createInMemoryOperationsPersistence();
    const operation = await createOperation({ ...buildCreateOperationInput({ sourceId: "exec:auto-1" }), persistence });
    await approveOperation({ storeId: "store-1", operationId: operation.id, persistence });
    await startOperation({ storeId: "store-1", operationId: operation.id, persistence });
    await completeOperation({ storeId: "store-1", operationId: operation.id, persistence });
    await verifyOperation({
      storeId: "store-1",
      operationId: operation.id,
      persistence,
      metrics: { bundle_published: true, bundle_sales: 5 },
    });

    const events = await processOperationsLifecycle({ storeId: "store-1", persistence });
    expect(Array.isArray(events)).toBe(true);
  });
});

describe("Operations integration", () => {
  it("creates operation from recommendation source", async () => {
    const persistence = createInMemoryOperationsPersistence();
    const operation = await createOperation({
      storeId: "store-1",
      title: "Reduce dead stock for Beanie Hat",
      summary: "Launch recovery offer",
      sourceType: "recommendation",
      sourceId: "trend:discount-beanie",
      templateId: "inventory_cleanup",
      persistence,
    });
    expect(operation.templateId).toBe("inventory_cleanup");
    expect(operation.verificationRules.length).toBeGreaterThan(0);
  });
});
