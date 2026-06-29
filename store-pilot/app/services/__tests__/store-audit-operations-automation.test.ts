import { describe, expect, it } from "vitest";
import { createInMemoryAutomationPersistence } from "../../automation/automation-persistence";
import { createInMemoryOperationsPersistence } from "../../operations/operations-persistence";
import { buildCreateAutomationInput } from "../../automation/__tests__/helpers";
import { createAutomation, listAutomations } from "../automation.server";
import { createOperation, approveOperation, listOperations } from "../operations.server";
import { buildCreateOperationInput } from "../../operations/__tests__/helpers";
import { inferAutomationTemplateId } from "../../automation/automation-templates";

describe("Store audit operations and automation integration", () => {
  it("creates operations from store audit themed executive actions via public API", async () => {
    const operationsPersistence = createInMemoryOperationsPersistence();
    const operation = await createOperation({
      ...buildCreateOperationInput({
        sourceId: "store-audit:compress-images",
        title: "Compress Images from Store Audit",
        summary: "Optimize product images identified by store audit",
        templateId: "inventory_cleanup",
      }),
      persistence: operationsPersistence,
    });

    await approveOperation({
      storeId: "store-1",
      operationId: operation.id,
      persistence: operationsPersistence,
    });

    const operations = await listOperations({ storeId: "store-1", persistence: operationsPersistence });
    expect(operations.some((item) => item.title.includes("Compress Images"))).toBe(true);
  });

  it("creates automation plans from store audit operations without Shopify mutations", async () => {
    const automationPersistence = createInMemoryAutomationPersistence();
    const templateId = inferAutomationTemplateId({ title: "Compress Images audit fix" });

    const automation = await createAutomation({
      ...buildCreateAutomationInput({
        sourceId: "store-audit:automation-compress",
        sourceType: "recommendation",
        title: "Compress Images",
        templateId,
      }),
      persistence: automationPersistence,
    });

    const automations = await listAutomations({ storeId: "store-test-001", persistence: automationPersistence });
    expect(automations.some((item) => item.id === automation.id)).toBe(true);
    expect(automation.approvalRequired).toBe(true);
    expect(automation.preview.noChangesExecuted).toBe(true);
  });

  it("maps SEO audit recommendations to SEO automation templates", () => {
    expect(inferAutomationTemplateId({ title: "Generate SEO Metadata for products" })).toBe(
      "generate_seo_metadata",
    );
    expect(inferAutomationTemplateId({ title: "Update product tags from audit" })).toBe("update_product_tags");
    expect(inferAutomationTemplateId({ title: "Generate product description" })).toBe(
      "generate_product_description",
    );
  });
});
