import { beforeEach, describe, expect, it } from "vitest";
import { AUTOMATION_TEMPLATES, getAutomationTemplate, inferAutomationTemplateId } from "../automation-templates";
import { canTransitionAutomation } from "../automation-state";
import { buildAutomationPreview, previewHasChanges, serializePreviewForMerchant } from "../automation-preview";
import { assessAutomationRisk, buildRollbackPlan, requiresExplicitApproval, riskWeight } from "../automation-risk";
import { evaluateAutomationVerificationRules, canVerifyAutomation } from "../automation-verification";
import { executeAutomationPlan, executionRequiresApproval } from "../automation-executor";
import { appendAutomationHistory } from "../automation-history";
import { calculateAutomationMetrics, buildAutomationCharts, updateAutomationLearningProfile } from "../automation-metrics";
import { validateCreateAutomationInput, validateDuplicateAutomation } from "../automation-validator";
import { planAutomationSteps, rankAutomationQueue, buildAutomationFromOperation } from "../automation-planner";
import { buildAutomationNotification } from "../automation-engine";
import { createInMemoryAutomationPersistence } from "../automation-persistence";
import { buildCreateAutomationInput, buildExecutableAutomationInput } from "./helpers";
import { createMockGraphqlRouter } from "../../shopify-automation/__tests__/helpers";
import { ShopifyExecutionError } from "../../shopify-automation/shopify-errors";
import {
  approveAutomation,
  archiveAutomation,
  cancelAutomation,
  createAutomation,
  executeAutomation,
  getAutomationCenterData,
  listAutomations,
  previewAutomation,
  rejectAutomation,
  requestAutomationChanges,
  submitAutomationForApproval,
  verifyAutomation,
} from "../../services/automation.server";

describe("Automation templates", () => {
  for (const template of AUTOMATION_TEMPLATES) {
    it(`defines template ${template.id}`, () => {
      expect(template.expectedChanges.length).toBeGreaterThan(0);
      expect(template.verificationRules.length).toBeGreaterThan(0);
      expect(template.rollbackSteps.length).toBeGreaterThan(0);
    });
  }

  it("includes sixteen reusable templates", () => {
    expect(AUTOMATION_TEMPLATES).toHaveLength(24);
  });

  it("infers bundle template", () => {
    expect(inferAutomationTemplateId({ title: "Launch Fitness Starter Bundle" })).toBe("create_bundle");
    expect(inferAutomationTemplateId({ title: "Compress product images" })).toBe("compress_images");
  });

  it("infers pricing automation templates", () => {
    expect(inferAutomationTemplateId({ title: "Update product price for Protein Powder" })).toBe(
      "update_product_price",
    );
    expect(inferAutomationTemplateId({ title: "Remove discount from bestseller" })).toBe("remove_discount");
    expect(inferAutomationTemplateId({ title: "Apply compare-at price for premium positioning" })).toBe(
      "apply_compare_at_price",
    );
    expect(inferAutomationTemplateId({ title: "Adjust bundle pricing for starter kit" })).toBe("adjust_bundle_price");
  });

  it("returns default template", () => {
    expect(getAutomationTemplate("create_bundle").name).toBe("Create Bundle");
  });
});

describe("Automation preview and risk", () => {
  it("builds preview without executing changes", () => {
    const template = getAutomationTemplate("create_bundle");
    const preview = buildAutomationPreview({
      template,
      title: "Create Bundle",
      products: ["Protein Powder", "Shaker Bottle"],
    });
    expect(preview.noChangesExecuted).toBe(true);
    expect(preview.products).toContain("Protein Powder");
  });

  it("serializes preview for merchant", () => {
    const automation = {
      preview: buildAutomationPreview({
        template: getAutomationTemplate("create_bundle"),
        title: "Bundle",
        products: ["A"],
      }),
    } as never;
    expect(serializePreviewForMerchant(automation)).toContain("No changes executed");
    expect(previewHasChanges(automation)).toBe(true);
  });

  it("assesses pricing risk as higher", () => {
    const template = getAutomationTemplate("schedule_discount");
    const result = assessAutomationRisk({
      template,
      products: ["SKU-1", "SKU-2", "SKU-3"],
      createInput: buildCreateAutomationInput({ revenueInfluenced: 15000 }),
    });
    expect(result.riskFactors).toContain("Pricing affected");
    expect(requiresExplicitApproval(result.riskLevel)).toBe(true);
    expect(riskWeight(result.riskLevel)).toBeGreaterThan(0);
  });

  it("builds rollback plan", () => {
    const plan = buildRollbackPlan({
      template: getAutomationTemplate("create_bundle"),
      products: ["A"],
    });
    expect(plan.rollbackSteps.length).toBeGreaterThan(0);
    expect(plan.beforeState.status).toBe("unchanged");
  });
});

describe("Automation verification and executor", () => {
  beforeEach(() => {
    globalThis.__D7_TEST__.mockAdminGraphql.mockReset();
    globalThis.__D7_TEST__.mockAdminGraphql.mockImplementation(createMockGraphqlRouter());
  });

  it("evaluates verification rules", () => {
    const rules = evaluateAutomationVerificationRules(
      [{ id: "1", label: "Bundle exists", metric: "bundle_exists", target: "true", satisfied: false }],
      { bundle_exists: true },
    );
    expect(rules[0]?.satisfied).toBe(true);
  });

  it("requires all rules before verification", () => {
    expect(
      canVerifyAutomation({
        verificationRules: [{ id: "1", label: "A", metric: "a", target: "true", satisfied: false }],
      } as never),
    ).toBe(false);
  });

  it("executes supported automations against Shopify Admin API", async () => {
    const result = await executeAutomationPlan({
      id: "auto-1",
      storeId: "store-test-001",
      merchantApproved: true,
      status: "executing",
      templateId: "update_product_tags",
      timeline: { approved: new Date().toISOString() },
      rollbackPlan: {
        beforeState: {
          payload: {
            shopifyProductId: "gid://shopify/Product/1001",
            tags: { action: "replace", values: ["protein", "fitness", "bestseller"] },
          },
        },
        afterState: {},
        rollbackSteps: [],
      },
      preview: {
        expectedChanges: [{ field: "Product Tags", before: "protein", after: "protein, fitness, bestseller" }],
      },
    } as never);
    expect(result.shopifyMutationsExecuted).toBe(true);
    expect(executionRequiresApproval()).toBe(true);
  });

  it("rejects unsupported templates during production execution", async () => {
    await expect(
      executeAutomationPlan({
        id: "auto-1",
        storeId: "store-test-001",
        merchantApproved: true,
        status: "executing",
        templateId: "create_bundle",
        rollbackPlan: { beforeState: { payload: {} }, afterState: {}, rollbackSteps: [] },
        preview: { expectedChanges: [{ field: "Title", before: null, after: "Bundle" }] },
      } as never),
    ).rejects.toThrow(ShopifyExecutionError);
  });

  it("rejects execution without merchant approval", async () => {
    await expect(
      executeAutomationPlan({ merchantApproved: false, status: "approved" } as never),
    ).rejects.toThrow("merchant_approval_required");
  });
});

describe("Automation planner and history", () => {
  it("builds automation from operation", () => {
    const input = buildAutomationFromOperation({
      id: "op-1",
      storeId: "store-test-001",
      title: "Launch bundle",
      summary: "Bundle launch",
      templateId: "bundle_launch",
      expectedRevenueImpact: 5000,
      status: "approved",
    } as never);
    expect(input.operationId).toBe("op-1");
    expect(planAutomationSteps("create_bundle").length).toBeGreaterThan(0);
  });

  it("ranks queue by risk", () => {
    const ranked = rankAutomationQueue([
      { riskLevel: "low", createdAt: "2026-06-20T08:00:00.000Z" },
      { riskLevel: "critical", createdAt: "2026-06-20T07:00:00.000Z" },
    ]);
    expect(ranked[0]?.riskLevel).toBe("critical");
  });

  it("appends history events", () => {
    const history = appendAutomationHistory({
      history: [],
      automation: { id: "auto-1", title: "Bundle" } as never,
      eventType: "created",
      message: "Created",
    });
    expect(history[0]?.eventType).toBe("created");
  });

  it("builds notifications", () => {
    const notification = buildAutomationNotification({
      automation: { id: "auto-1", title: "Bundle" } as never,
      type: "automation_created",
      title: "Created",
      message: "Waiting approval",
    });
    expect(notification.automationId).toBe("auto-1");
  });
});

describe("Automation metrics and validation", () => {
  it("calculates automation metrics", () => {
    const metrics = calculateAutomationMetrics([
      { status: "prepared", estimatedTimeSavedMinutes: 10, revenueInfluenced: 1000, operationId: "op-1" } as never,
      { status: "verified", estimatedTimeSavedMinutes: 20, revenueInfluenced: 2000, operationId: "op-2", merchantApproved: true } as never,
    ]);
    expect(metrics.automationsPrepared).toBe(2);
    expect(metrics.revenueInfluenced).toBe(3000);
    expect(buildAutomationCharts([], metrics).merchantApprovalRate.length).toBe(2);
  });

  it("updates merchant learning profile", () => {
    const learning = updateAutomationLearningProfile({
      learning: {
        approvedCategories: [],
        rejectedCategories: [],
        delayedCategories: [],
        preferredTemplates: [],
        approvalRate: 0,
      },
      automation: { templateId: "create_bundle" } as never,
      action: "approved",
    });
    expect(learning.approvedCategories).toContain("create_bundle");
  });

  it("validates create input", () => {
    expect(() => validateCreateAutomationInput(buildCreateAutomationInput())).not.toThrow();
  });

  it("rejects duplicate automations", () => {
    expect(() =>
      validateDuplicateAutomation([{ automationKey: "abc", status: "prepared" } as never], "abc"),
    ).toThrow();
  });
});

describe("Automation state machine", () => {
  it("allows draft to prepared", () => {
    expect(canTransitionAutomation("draft", "prepared")).toBe(true);
    expect(canTransitionAutomation("draft", "approved")).toBe(false);
  });

  it("allows waiting approval to approved", () => {
    expect(canTransitionAutomation("waiting_approval", "approved")).toBe(true);
    expect(canTransitionAutomation("waiting_approval", "prepared")).toBe(true);
  });

  it("allows verifying to verified", () => {
    expect(canTransitionAutomation("verifying", "verified")).toBe(true);
  });
});

describe("Automation public API lifecycle", () => {
  const persistence = createInMemoryAutomationPersistence();

  beforeEach(() => {
    globalThis.__D7_TEST__.mockAdminGraphql.mockReset();
    globalThis.__D7_TEST__.mockAdminGraphql.mockImplementation(createMockGraphqlRouter());
  });

  it("creates automation in prepared state", async () => {
    const automation = await createAutomation({
      ...buildCreateAutomationInput({ sourceId: "operation:create-1" }),
      persistence,
    });
    expect(automation.status).toBe("prepared");
    expect(automation.approvalRequired).toBe(true);
  });

  it("generates preview text", async () => {
    const automation = await createAutomation({
      ...buildCreateAutomationInput({ sourceId: "operation:preview-1" }),
      persistence,
    });
    const preview = await previewAutomation({
      storeId: "store-test-001",
      automationId: automation.id,
      persistence,
    });
    expect(preview).toContain("No changes executed");
  });

  it("runs full lifecycle approve execute verify archive", async () => {
    const created = await createAutomation({
      ...buildExecutableAutomationInput({ sourceId: "operation:lifecycle-1" }),
      persistence,
    });
    const approved = await approveAutomation({
      storeId: "store-test-001",
      automationId: created.id,
      persistence,
    });
    expect(approved.merchantApproved).toBe(true);
    const executed = await executeAutomation({
      storeId: "store-test-001",
      automationId: created.id,
      persistence,
    });
    expect(executed.status).toBe("executed");
    const verified = await verifyAutomation({
      storeId: "store-test-001",
      automationId: created.id,
      metrics: { tags_updated: true },
      persistence,
    });
    expect(verified.status).toBe("verified");
    const archived = await archiveAutomation({
      storeId: "store-test-001",
      automationId: created.id,
      persistence,
    });
    expect(archived.status).toBe("archived");
  });

  it("supports reject and request changes workflow", async () => {
    const created = await createAutomation({
      ...buildCreateAutomationInput({ sourceId: "operation:reject-1" }),
      persistence,
    });
    await submitAutomationForApproval({ storeId: "store-test-001", automationId: created.id, persistence });
    const rejected = await rejectAutomation({
      storeId: "store-test-001",
      automationId: created.id,
      note: "Pricing too risky",
      persistence,
    });
    expect(rejected.merchantRejected).toBe(true);

    const created2 = await createAutomation({
      ...buildCreateAutomationInput({ sourceId: "operation:changes-1" }),
      persistence,
    });
    await submitAutomationForApproval({ storeId: "store-test-001", automationId: created2.id, persistence });
    await requestAutomationChanges({
      storeId: "store-test-001",
      automationId: created2.id,
      note: "Update bundle title",
      persistence,
    });
    const listed = await listAutomations({ storeId: "store-test-001", persistence });
    expect(listed.some((item) => item.changeRequestNote?.includes("Update bundle title"))).toBe(true);
  });

  it("cancels automation", async () => {
    const created = await createAutomation({
      ...buildCreateAutomationInput({ sourceId: "operation:cancel-1" }),
      persistence,
    });
    const cancelled = await cancelAutomation({
      storeId: "store-test-001",
      automationId: created.id,
      persistence,
    });
    expect(cancelled.status).toBe("cancelled");
  });

  it("aggregates dashboard data", async () => {
    await createAutomation({
      ...buildCreateAutomationInput({ sourceId: "operation:dashboard-1" }),
      persistence,
    });
    const center = await getAutomationCenterData({
      storeId: "store-test-001",
      persistence,
      syncFromOperations: false,
    });
    expect(center.automationQueue.length).toBeGreaterThan(0);
    expect(center.charts.approvalFunnel.length).toBeGreaterThan(0);
  });
});
