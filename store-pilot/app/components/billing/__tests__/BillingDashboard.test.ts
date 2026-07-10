import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";

import { BillingDashboard } from "../BillingDashboard";
import { getCanonicalPlan, listCanonicalPlans } from "../../../billing/billing-limits";
import { BILLING_CONFIG } from "../../../billing/plan-config";

describe("Billing Dashboard component", () => {
  it("renders billing sections with canonical pricing", () => {
    const growthPlan = getCanonicalPlan("growth");
    const html = renderToString(
      createElement(BillingDashboard, {
        dashboard: {
          storeId: "store-test-001",
          computedAt: new Date().toISOString(),
          aggregationDurationMs: 10,
          currentPlan: growthPlan,
          commercialStatus: "trialing",
          trial: {
            active: true,
            trialStart: new Date().toISOString(),
            trialEnd: new Date(Date.now() + 86400000).toISOString(),
            remainingDays: BILLING_CONFIG.trialDays,
            expired: false,
            upgradePrompt: null,
          },
          usage: {
            storeId: "store-test-001",
            month: "2026-06",
            aiExecutions: 10,
            automationExecutions: 0,
            connectorSyncs: 0,
            operationsCreated: 0,
            apiRequests: 0,
            backgroundJobs: 0,
            dataExports: 0,
            storageMb: 0,
            executiveBriefings: 0,
            predictions: 0,
            experiments: 0,
            knowledgeGraphNodes: 0,
            products: 0,
            reports: 0,
          },
          limits: growthPlan,
          usageChecks: {} as never,
          notifications: [],
          upgradeRecommendations: [],
          plans: listCanonicalPlans(),
          canUpgrade: true,
          canDowngrade: false,
          canCancel: true,
          historyPlaceholder: true,
          invoicesPlaceholder: true,
          workerQueueTier: "normal",
        },
      }),
    );

    expect(html).toContain("Billing");
    expect(html).toContain(String(BILLING_CONFIG.plans.growth.price));
    expect(html).toContain("Trial Status");
    expect(html).toContain("Usage Overview");
  });
});
