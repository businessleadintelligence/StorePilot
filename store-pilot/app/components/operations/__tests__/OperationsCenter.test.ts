import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { OperationsCenter } from "../OperationsCenter";
import { buildEmptyOperationsCenterData } from "../../../operations/__tests__/helpers";

describe("Operations Center component", () => {
  it("renders operations dashboard sections", () => {
    const html = renderToString(
      createElement(OperationsCenter, {
        data: {
          ...buildEmptyOperationsCenterData(),
          metrics: {
            executionRate: 0.5,
            completionRate: 0.4,
            verificationSuccessRate: 0.8,
            averageCompletionMinutes: 42,
            revenueGenerated: 12000,
            inventoryReduced: 800,
            merchantProductivity: 0.6,
          },
          achievements: ["Execution Streak"],
        },
      }),
    );

    expect(html).toContain("AI Operations Center");
    expect(html).toContain("AI Inbox");
    expect(html).toContain("Kanban");
    expect(html).toContain("Verification Queue");
    expect(html).toContain("Execution Streak");
  });
});
