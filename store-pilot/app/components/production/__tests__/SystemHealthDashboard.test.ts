import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";

import { SystemHealthDashboard } from "../SystemHealthDashboard";
import { buildDashboard } from "../../../production/__tests__/helpers";

describe("System Health Dashboard component", () => {
  it("renders production monitoring sections", () => {
    const html = renderToString(
      createElement(SystemHealthDashboard, {
        dashboard: buildDashboard({
          alerts: [
            {
              id: "alert-1",
              subsystemId: "ga4",
              severity: "critical",
              title: "Google Analytics disconnected",
              message: "Connect GA4 in Settings",
              recoveryAction: "Connect Google Analytics in Settings",
              createdAt: new Date().toISOString(),
              dismissed: false,
              resolved: false,
            },
          ],
          recoveryActions: [
            {
              id: "recovery-ga4",
              label: "Connect Google Analytics in Settings",
              href: "/app/settings",
            },
          ],
        }),
      }),
    );

    expect(html).toContain("System Health");
    expect(html).toContain("Overall Platform Health");
    expect(html).toContain("Connector Status");
    expect(html).toContain("Data Quality");
    expect(html).toContain("Recent Alerts");
    expect(html).toContain("Recovery Actions");
    expect(html).toContain("Google Analytics disconnected");
  });
});
