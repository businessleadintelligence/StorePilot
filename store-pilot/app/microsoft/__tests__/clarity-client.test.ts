import { beforeEach, describe, expect, it } from "vitest";

import {
  configureClarityClientDeps,
  fetchClarityAnalyticsReport,
  resetClarityClientDeps,
} from "../clarity/clarity-client";
import { ClarityApiError } from "../clarity/clarity-api-error";

describe("Clarity client", () => {
  beforeEach(() => {
    resetClarityClientDeps();
  });

  it("fetches aggregate and segmented reports in parallel", async () => {
    const requestedUrls: string[] = [];

    configureClarityClientDeps({
      fetchInsights: async ({ url }) => {
        requestedUrls.push(url);
        if (url.includes("dimension1=URL")) {
          return [
            {
              metricName: "Traffic",
              information: [{ URL: "https://store.example.com/", totalSessionCount: "100" }],
            },
          ];
        }
        if (url.includes("dimension1=Device")) {
          return [
            {
              metricName: "Traffic",
              information: [{ Device: "Mobile", totalSessionCount: "100" }],
            },
          ];
        }
        return [
          {
            metricName: "Traffic",
            information: [{ totalSessionCount: "100" }],
          },
          {
            metricName: "Rage Click Count",
            information: [{ rageClickCount: "5" }],
          },
        ];
      },
    });

    const report = await fetchClarityAnalyticsReport({
      projectId: "clarity-project-1",
      apiToken: "api-token",
    });

    expect(requestedUrls.length).toBe(5);
    expect(report.projectId).toBe("clarity-project-1");
    expect(report.summary.sessions).toBe(100);
    expect(report.summary.rageClicks).toBe(5);
  });

  it("rejects missing project IDs", async () => {
    await expect(
      fetchClarityAnalyticsReport({
        projectId: "   ",
        apiToken: "api-token",
      }),
    ).rejects.toMatchObject({ code: "missing_project" });
  });

  it("propagates quota exceeded failures", async () => {
    configureClarityClientDeps({
      fetchInsights: async () => {
        throw new ClarityApiError({
          code: "quota_exceeded",
          message: "Exceeded daily limit",
          retryable: true,
        });
      },
    });

    await expect(
      fetchClarityAnalyticsReport({
        projectId: "clarity-project-1",
        apiToken: "api-token",
      }),
    ).rejects.toMatchObject({ code: "quota_exceeded" });
  });
});
