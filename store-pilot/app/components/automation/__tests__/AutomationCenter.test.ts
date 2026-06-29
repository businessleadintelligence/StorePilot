import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { AutomationCenter } from "../AutomationCenter";
import { buildEmptyAutomationCenterData } from "../../../automation/__tests__/helpers";

describe("Automation Center component", () => {
  it("renders automation dashboard sections", () => {
    const html = renderToString(
      createElement(AutomationCenter, {
        data: {
          ...buildEmptyAutomationCenterData(),
          metrics: {
            automationsPrepared: 3,
            automationsApproved: 2,
            approvalRate: 0.66,
            executionRate: 0.5,
            verificationRate: 0.8,
            merchantTimeSavedMinutes: 120,
            revenueInfluenced: 15000,
            operationsAutomated: 2,
            merchantApprovalRate: 0.75,
          },
          pendingApprovals: [
            {
              id: "auto-1",
              title: "Create Bundle",
              templateId: "create_bundle",
              riskLevel: "medium",
              preview: { products: ["Protein Powder"] },
            } as never,
          ],
        },
      }),
    );

    expect(html).toContain("AI Automation Center");
    expect(html).toContain("Pending Approvals");
    expect(html).toContain("Automation Queue");
    expect(html).toContain("Verification Queue");
    expect(html).toContain("Execution Metrics");
    expect(html).toContain("Risk Analysis");
  });
});
