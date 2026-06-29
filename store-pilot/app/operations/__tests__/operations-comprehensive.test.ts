import { describe, expect, it } from "vitest";
import { WORKFLOW_TEMPLATES, buildTasksFromTemplate, getWorkflowTemplate, inferWorkflowTemplateId } from "../operations-workflows";
import { canTransitionOperation, mapStatusToKanbanColumn } from "../operations-state";
import { calculateOperationProgress, estimateRemainingMinutes } from "../operations-progress";
import { evaluateVerificationRules, canCompleteOperation } from "../operations-verification";
import { calculateOperationPriorityScore, rankOperationsQueue } from "../operations-priority";
import { bucketOperationsByCalendar, findOverdueOperations } from "../operations-scheduler";
import { buildOperationNotification } from "../operations-notifications";
import { appendOperationHistory } from "../operations-history";
import { calculateOperationsMetrics, buildOperationsCharts, buildAchievements } from "../operations-metrics";
import { validateCreateOperationInput, validateDuplicateOperation } from "../operations-validator";
import { createInMemoryOperationsPersistence } from "../operations-persistence";
import { buildCreateOperationInput } from "./helpers";
import {
  approveOperation,
  archiveOperation,
  completeOperation,
  createOperation,
  getOperationsCenterData,
  listOperations,
  startOperation,
  verifyOperation,
} from "../../services/operations.server";

describe("Operations workflows", () => {
  for (const template of WORKFLOW_TEMPLATES) {
    it(`defines workflow template ${template.id}`, () => {
      expect(template.tasks.length).toBeGreaterThan(0);
      expect(template.verificationRules.length).toBeGreaterThan(0);
    });
  }

  it("infers bundle launch template", () => {
    expect(inferWorkflowTemplateId({ title: "Launch Fitness Starter Bundle" })).toBe("bundle_launch");
  });

  it("infers growth strategy workflow templates", () => {
    expect(inferWorkflowTemplateId({ title: "Launch upsell campaign for hero products" })).toBe("launch_upsell_campaign");
    expect(inferWorkflowTemplateId({ title: "Launch cross-sell campaign for accessories" })).toBe(
      "launch_cross_sell_campaign",
    );
    expect(inferWorkflowTemplateId({ title: "Improve AOV with basket expansion" })).toBe("improve_aov");
    expect(inferWorkflowTemplateId({ title: "Improve repeat purchases with win-back" })).toBe(
      "improve_repeat_purchases",
    );
    expect(inferWorkflowTemplateId({ title: "Optimize collection performance" })).toBe("optimize_collections");
    expect(inferWorkflowTemplateId({ title: "Optimize merchandising placements" })).toBe("optimize_merchandising");
    expect(inferWorkflowTemplateId({ title: "Homepage campaign for growth" })).toBe("homepage_campaign");
    expect(inferWorkflowTemplateId({ title: "Seasonal campaign for summer peak" })).toBe("seasonal_campaign");
    expect(inferWorkflowTemplateId({ title: "Customer retention campaign for churn risk" })).toBe(
      "customer_retention_campaign",
    );
  });

  it("infers pricing strategy workflow templates", () => {
    expect(inferWorkflowTemplateId({ title: "Raise price on Protein Powder" })).toBe("price_increase");
    expect(inferWorkflowTemplateId({ title: "Reduce price on slow movers" })).toBe("price_reduction");
    expect(inferWorkflowTemplateId({ title: "Launch markdown campaign for clearance" })).toBe("markdown_campaign");
    expect(inferWorkflowTemplateId({ title: "Premium positioning for flagship SKU" })).toBe("premium_positioning");
    expect(inferWorkflowTemplateId({ title: "Adjust bundle pricing for starter kit" })).toBe("bundle_pricing");
    expect(inferWorkflowTemplateId({ title: "Discount optimization for margin protection" })).toBe(
      "discount_optimization",
    );
  });

  it("builds tasks from template", () => {
    expect(buildTasksFromTemplate("bundle_launch")).toHaveLength(5);
    expect(getWorkflowTemplate("inventory_cleanup").name).toBe("Inventory Cleanup");
  });
});

describe("Operations state machine", () => {
  it("maps pending to planned kanban column", () => {
    expect(mapStatusToKanbanColumn("pending")).toBe("planned");
    expect(mapStatusToKanbanColumn("verification")).toBe("verification");
  });

  it("allows pending to approved transition", () => {
    expect(canTransitionOperation("pending", "approved")).toBe(true);
    expect(canTransitionOperation("pending", "in_progress")).toBe(false);
  });
});

describe("Operations progress and verification", () => {
  it("calculates progress from tasks", () => {
    expect(
      calculateOperationProgress([
        { id: "1", title: "A", completed: true, completedAt: null, order: 1 },
        { id: "2", title: "B", completed: false, completedAt: null, order: 2 },
      ]),
    ).toBe(50);
  });

  it("evaluates verification rules", () => {
    const rules = evaluateVerificationRules(
      [{ id: "1", label: "Bundle published", metric: "bundle_published", target: "true", satisfied: false }],
      { bundle_published: true },
    );
    expect(rules[0]?.satisfied).toBe(true);
  });

  it("requires all tasks before completion", () => {
    expect(
      canCompleteOperation({
        tasks: [{ id: "1", title: "A", completed: false, completedAt: null, order: 1 }],
      } as never),
    ).toBe(false);
  });

  it("estimates remaining minutes", () => {
    expect(
      estimateRemainingMinutes({
        estimatedMinutes: 45,
        tasks: [
          { id: "1", title: "A", completed: true, completedAt: null, order: 1 },
          { id: "2", title: "B", completed: false, completedAt: null, order: 2 },
        ],
      } as never),
    ).toBeGreaterThan(0);
  });
});

describe("Operations priority and scheduler", () => {
  it("ranks operations by priority score", () => {
    const ranked = rankOperationsQueue([
      { priorityScore: 50, estimatedRemainingMinutes: 30, createdAt: "2026-06-20T08:00:00.000Z" } as never,
      { priorityScore: 90, estimatedRemainingMinutes: 20, createdAt: "2026-06-20T09:00:00.000Z" } as never,
    ]);
    expect(ranked[0]?.priorityScore).toBe(90);
  });

  it("calculates priority score with revenue and risk", () => {
    expect(
      calculateOperationPriorityScore({
        priority: "critical",
        expectedRevenueImpact: 5000,
        expectedInventoryImpact: 500,
        difficulty: "Easy",
        dueAt: null,
        blocked: false,
      }),
    ).toBeGreaterThan(80);
  });

  it("buckets calendar operations", () => {
    const buckets = bucketOperationsByCalendar([
      {
        scheduledFor: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      } as never,
    ]);
    expect(buckets.today.length).toBe(1);
  });

  it("finds overdue operations", () => {
    const overdue = findOverdueOperations([
      {
        dueAt: "2020-01-01T00:00:00.000Z",
        status: "in_progress",
      } as never,
    ]);
    expect(overdue).toHaveLength(1);
  });
});

describe("Operations notifications, history, metrics", () => {
  it("builds operation notifications", () => {
    const notification = buildOperationNotification({
      operation: { id: "op-1", title: "Launch bundle" } as never,
      type: "operation_created",
      title: "Created",
      message: "Waiting approval",
    });
    expect(notification.operationId).toBe("op-1");
  });

  it("appends immutable history", () => {
    const history = appendOperationHistory({
      history: [],
      operation: { id: "op-1", title: "Launch bundle" } as never,
      eventType: "created",
      message: "Created",
    });
    expect(history[0]?.eventType).toBe("created");
  });

  it("calculates operations metrics", () => {
    const metrics = calculateOperationsMetrics([
      { status: "in_progress", expectedRevenueImpact: 1000, expectedInventoryImpact: 100, startedAt: "2026-06-20T08:00:00.000Z", completedAt: "2026-06-20T09:00:00.000Z" } as never,
      { status: "verified", expectedRevenueImpact: 2000, expectedInventoryImpact: 200 } as never,
    ]);
    expect(metrics.revenueGenerated).toBe(3000);
    expect(buildAchievements(metrics).length).toBeGreaterThan(0);
    expect(buildOperationsCharts([], metrics).capacityGauge.length).toBe(2);
  });
});

describe("Operations validation", () => {
  it("validates create operation input", () => {
    expect(() => validateCreateOperationInput(buildCreateOperationInput())).not.toThrow();
  });

  it("rejects duplicate operations", () => {
    expect(() =>
      validateDuplicateOperation([{ sourceId: "executive:1", status: "pending" } as never], "executive:1"),
    ).toThrow();
  });
});

describe("Operations public API lifecycle", () => {
  const persistence = createInMemoryOperationsPersistence();

  it("creates operation from executive decision", async () => {
    const operation = await createOperation({ ...buildCreateOperationInput(), persistence });
    expect(operation.status).toBe("pending");
    expect(operation.tasks.length).toBeGreaterThan(0);
  });

  it("runs full lifecycle approve start complete verify archive", async () => {
    const created = await createOperation({
      ...buildCreateOperationInput({ sourceId: "executive:lifecycle-1" }),
      persistence,
    });
    await approveOperation({ storeId: "store-1", operationId: created.id, persistence });
    await startOperation({ storeId: "store-1", operationId: created.id, persistence });
    await completeOperation({ storeId: "store-1", operationId: created.id, persistence });
    await verifyOperation({
      storeId: "store-1",
      operationId: created.id,
      persistence,
      metrics: { bundle_published: true, bundle_sales: 5 },
    });
    const verified = await listOperations({ storeId: "store-1", persistence });
    expect(verified.find((item) => item.id === created.id)?.status).toBe("verified");
    await archiveOperation({ storeId: "store-1", operationId: created.id, persistence });
  });

  it("builds operations center dashboard data", async () => {
    await createOperation({
      ...buildCreateOperationInput({ sourceId: "executive:dashboard-1" }),
      persistence,
    });
    const data = await getOperationsCenterData({
      storeId: "store-1",
      persistence,
      syncFromCollaboration: false,
    });
    expect(data.inbox.waitingApproval.length).toBeGreaterThan(0);
    expect(data.kanban.planned.length).toBeGreaterThan(0);
    expect(data.charts.burnDown.length).toBe(2);
  });

  it("lists non-archived operations", async () => {
    const operations = await listOperations({ storeId: "store-1", persistence });
    expect(Array.isArray(operations)).toBe(true);
  });
});
