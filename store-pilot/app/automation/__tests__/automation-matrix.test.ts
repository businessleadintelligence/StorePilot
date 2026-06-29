import { describe, expect, it } from "vitest";
import { AUTOMATION_STATUSES } from "../automation-types";
import { canTransitionAutomation } from "../automation-state";

const ALLOWED: Record<string, string[]> = {
  draft: ["prepared", "cancelled"],
  prepared: ["waiting_approval", "cancelled"],
  waiting_approval: ["approved", "prepared", "cancelled"],
  approved: ["executing", "cancelled"],
  executing: ["executed", "cancelled"],
  executed: ["verifying", "cancelled"],
  verifying: ["verified", "executed"],
  verified: ["archived"],
  archived: [],
  cancelled: [],
};

describe("Automation transition matrix", () => {
  for (const from of AUTOMATION_STATUSES) {
    for (const to of AUTOMATION_STATUSES) {
      const expected = ALLOWED[from]?.includes(to) ?? false;
      it(`${from} -> ${to} is ${expected ? "allowed" : "blocked"}`, () => {
        expect(canTransitionAutomation(from, to)).toBe(expected);
      });
    }
  }
});
