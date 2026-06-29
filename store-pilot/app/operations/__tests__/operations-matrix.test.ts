import { describe, expect, it } from "vitest";
import { OPERATION_STATUSES, KANBAN_COLUMNS } from "../operations-types";
import { WORKFLOW_TEMPLATES } from "../operations-workflows";
import { mapStatusToKanbanColumn, canTransitionOperation } from "../operations-state";
import { inferPriorityFromSource } from "../operations-priority";
import { notificationForStatusChange } from "../operations-notifications";

describe("Operations type coverage", () => {
  for (const status of OPERATION_STATUSES) {
    it(`supports status ${status}`, () => {
      expect(mapStatusToKanbanColumn(status)).toBeTruthy();
    });
  }

  for (const column of KANBAN_COLUMNS) {
    it(`supports kanban column ${column}`, () => {
      expect(column.length).toBeGreaterThan(2);
    });
  }

  for (const template of WORKFLOW_TEMPLATES) {
    it(`template ${template.id} has checklist items`, () => {
      expect(template.checklist.length).toBeGreaterThan(0);
      expect(template.completionRules.length).toBeGreaterThan(0);
    });

    for (const task of template.tasks) {
      it(`template ${template.id} task ${task.title}`, () => {
        expect(task.title.length).toBeGreaterThan(3);
      });
    }
  }
});

describe("Operations priority inference", () => {
  it("infers critical priority from risk", () => {
    expect(inferPriorityFromSource({ risk: "high" })).toBe("critical");
  });

  it("infers low priority", () => {
    expect(inferPriorityFromSource({ priority: 4 })).toBe("low");
  });
});

describe("Operations notification transitions", () => {
  it("creates approved notification", () => {
    const notification = notificationForStatusChange({
      operation: { id: "1", title: "Launch bundle", verificationStatus: "pending", blockedReason: null } as never,
      fromStatus: "pending",
      toStatus: "approved",
    });
    expect(notification?.type).toBe("operation_approved");
  });

  it("creates blocked notification", () => {
    const notification = notificationForStatusChange({
      operation: {
        id: "1",
        title: "Launch bundle",
        verificationStatus: "pending",
        blockedReason: "Missing inventory",
      } as never,
      fromStatus: "in_progress",
      toStatus: "blocked",
    });
    expect(notification?.type).toBe("operation_blocked");
  });
});

describe("Operations transition matrix", () => {
  const pairs = [
    ["pending", "approved", true],
    ["approved", "in_progress", true],
    ["in_progress", "verification", true],
    ["verified", "archived", true],
    ["pending", "verified", false],
  ] as const;

  for (const [from, to, allowed] of pairs) {
    it(`${from} -> ${to} is ${allowed ? "allowed" : "blocked"}`, () => {
      expect(canTransitionOperation(from, to)).toBe(allowed);
    });
  }
});
