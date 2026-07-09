import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";

import { BillingDashboard } from "../../components/billing/BillingDashboard";
import { assertBillingConfigValid, validateBillingConfig } from "../billing-config-validator";
import { buildBillingDashboard } from "../billing-dashboard";
import { getCanonicalPlan, listCanonicalPlans } from "../billing-limits";
import { BILLING_CONFIG, BILLING_PLAN_SLUGS } from "../plan-config";

const billingRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const appRoot = join(billingRoot, "..");

function collectSourceFiles(directory: string, files: string[] = []): string[] {
  for (const entry of readdirSync(directory)) {
    const fullPath = join(directory, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      if (entry === "__tests__" || entry === "node_modules") {
        continue;
      }
      collectSourceFiles(fullPath, files);
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".test.ts") && !entry.endsWith(".test.tsx")) {
      files.push(fullPath);
    }
  }
  return files;
}

describe("billing config validator", () => {
  it("validates canonical billing configuration", () => {
    const result = validateBillingConfig();
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(() => assertBillingConfigValid()).not.toThrow();
  });

  it("includes every plan in plans, limits, and features", () => {
    for (const slug of BILLING_PLAN_SLUGS) {
      expect(BILLING_CONFIG.plans[slug]).toBeDefined();
      expect(BILLING_CONFIG.limits[slug]).toBeDefined();
      expect(BILLING_CONFIG.features[slug]).toBeDefined();
    }
  });

  it("keeps trialDays consistent across plans", () => {
    for (const slug of BILLING_PLAN_SLUGS) {
      expect(BILLING_CONFIG.plans[slug].trialDays).toBe(BILLING_CONFIG.trialDays);
    }
  });
});

describe("billing single source of truth", () => {
  it("derives plan pricing only from plan-config", () => {
    for (const slug of BILLING_PLAN_SLUGS) {
      expect(getCanonicalPlan(slug).monthlyPriceUsd).toBe(BILLING_CONFIG.plans[slug].price);
    }
    expect(listCanonicalPlans()).toHaveLength(BILLING_PLAN_SLUGS.length);
  });

  it("does not hardcode plan prices outside plan-config.ts", () => {
    const scanRoots = [billingRoot, join(appRoot, "components", "billing"), join(appRoot, "routes")];
    const offenders: string[] = [];

    for (const root of scanRoots) {
      for (const file of collectSourceFiles(root)) {
        if (file.endsWith("plan-config.ts")) {
          continue;
        }

        const content = readFileSync(file, "utf8");
        for (const price of ["29", "79", "199", "399"]) {
          const pricePattern = new RegExp(`\\b${price}\\b`);
          if (pricePattern.test(content) && !content.includes("plan-config")) {
            offenders.push(`${relative(appRoot, file)} contains hardcoded price ${price}`);
          }
        }
      }
    }

    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("requires billing modules to import plan-config", () => {
    const directConfigModules = [
      "billing-limits.ts",
      "billing-entitlements.ts",
      "shopify-billing.server.ts",
      "billing-onboarding.ts",
      "billing-config-validator.ts",
    ];
    const derivedConfigModules = ["billing-dashboard.ts", "billing-engine.ts"];

    for (const moduleName of directConfigModules) {
      const content = readFileSync(join(billingRoot, moduleName), "utf8");
      expect(content.includes("plan-config")).toBe(true);
    }

    for (const moduleName of derivedConfigModules) {
      const content = readFileSync(join(billingRoot, moduleName), "utf8");
      expect(content.includes("billing-limits") || content.includes("plan-config")).toBe(true);
    }
  });

  it("matches UI pricing to plan-config", async () => {
    const growth = getCanonicalPlan("growth");
    const html = renderToString(
      createElement(BillingDashboard, {
        dashboard: {
          storeId: "store-test-001",
          computedAt: new Date().toISOString(),
          aggregationDurationMs: 10,
          currentPlan: growth,
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
          },
          limits: growth,
          usageChecks: {} as never,
          notifications: [],
          upgradeRecommendations: [],
          plans: listCanonicalPlans(),
          canUpgrade: true,
          canDowngrade: false,
          canCancel: true,
          historyPlaceholder: true,
          invoicesPlaceholder: true,
        },
      }),
    );

    expect(html).toContain(String(BILLING_CONFIG.plans.growth.price));
    expect(html).toContain(String(BILLING_CONFIG.plans.starter.price));
  });
});

describe("billing dashboard config alignment", () => {
  it("builds dashboard plans from plan-config pricing", async () => {
    const { createTrialSubscription } = await import("../../services/billing.server");
    const { STORE_ID, testHarness } = await import("../../services/__tests__/helpers/fixtures");

    testHarness().resetDbState();
    testHarness().dbState.subscriptions.clear();
    await createTrialSubscription(STORE_ID, "growth");

    const dashboard = await buildBillingDashboard(STORE_ID);
    for (const plan of dashboard.plans) {
      expect(plan.monthlyPriceUsd).toBe(BILLING_CONFIG.plans[plan.slug].price);
    }
  });
});
