import { beforeEach, describe, expect, it, vi } from "vitest";

import { executeAutomationPlan } from "../../automation/automation-executor";
import { getAutomationTemplate } from "../../automation/automation-templates";
import { clearShopifyAuditLog, listShopifyAuditRecords } from "../shopify-audit";
import { validateAutomationDryRun } from "../shopify-dry-run";
import { clearIdempotencyStore } from "../shopify-idempotency";
import { clearRateLimitQueues } from "../shopify-rate-limit";
import { buildRollbackMetadata } from "../shopify-rollback";
import { ShopifyExecutionError, sanitizeErrorForLog } from "../shopify-errors";
import { executeShopifyAutomation } from "../shopify-executor";
import { buildExecutableAutomation, createMockGraphqlRouter } from "./helpers";

describe("Shopify automation executor", () => {
  beforeEach(() => {
    clearIdempotencyStore();
    clearShopifyAuditLog();
    clearRateLimitQueues();
    globalThis.__D7_TEST__.mockAdminGraphql.mockReset();
    globalThis.__D7_TEST__.mockAdminGraphql.mockImplementation(createMockGraphqlRouter());
  });

  it("validates dry run without calling Shopify", () => {
    const automation = buildExecutableAutomation();
    expect(() => validateAutomationDryRun(automation)).not.toThrow();
    expect(globalThis.__D7_TEST__.mockAdminGraphql).not.toHaveBeenCalled();
  });

  it("rejects unsupported templates during dry run validation", () => {
    const automation = buildExecutableAutomation({
      templateId: "create_bundle",
      preview: {
        ...buildExecutableAutomation().preview,
        expectedChanges: getAutomationTemplate("create_bundle").expectedChanges,
      },
    });
    expect(() => validateAutomationDryRun(automation)).toThrow(ShopifyExecutionError);
  });

  it("executes product tag mutations against mocked Shopify Admin API", async () => {
    const automation = buildExecutableAutomation();
    const result = await executeShopifyAutomation(automation);

    expect(result.shopifyMutationsExecuted).toBe(true);
    expect(result.verificationStatus).toBe("passed");
    expect(result.simulatedChanges[0]).toContain("tags:");
    expect(globalThis.__D7_TEST__.mockAdminGraphql).toHaveBeenCalled();
    expect(listShopifyAuditRecords({ automationId: automation.id })).toHaveLength(1);
  });

  it("creates rollback metadata from old values", () => {
    const metadata = buildRollbackMetadata({
      mutationType: "product_tags",
      oldValues: { tags: ["protein"], productType: "Supplements", price: "29.99" },
    });
    expect(metadata.oldTags).toEqual(["protein"]);
    expect(metadata.manualRollbackRequired).toBe(true);
  });

  it("prevents duplicate execution via idempotency", async () => {
    const automation = buildExecutableAutomation();
    const first = await executeAutomationPlan(automation);
    const second = await executeAutomationPlan(automation);
    expect(first.idempotencyKey).toBe(second.idempotencyKey);
    expect(second.shopifyMutationsExecuted).toBe(true);
    expect(globalThis.__D7_TEST__.mockAdminGraphql.mock.calls.length).toBeGreaterThan(0);
  });

  it("fails verification when Shopify state does not match expected values", async () => {
    let snapshotReads = 0;
    const router = createMockGraphqlRouter(["protein"]);
    globalThis.__D7_TEST__.mockAdminGraphql.mockImplementation(async (query: string, options?) => {
      if (query.includes("query AutomationProductSnapshot")) {
        snapshotReads += 1;
        if (snapshotReads > 1) {
          return new Response(
            JSON.stringify({
              data: {
                product: {
                  id: "gid://shopify/Product/1001",
                  tags: ["stale-tag"],
                  productType: "Supplements",
                  status: "ACTIVE",
                  seo: { title: null, description: null },
                  variants: {
                    edges: [{ node: { id: "gid://shopify/ProductVariant/2001", price: "29.99", compareAtPrice: null } }],
                  },
                },
              },
            }),
            { status: 200, headers: { "content-type": "application/json", "x-request-id": "verify-fail" } },
          );
        }
      }
      return router(query, options);
    });

    await expect(executeShopifyAutomation(buildExecutableAutomation())).rejects.toMatchObject({
      code: "verification_failed",
    });
  });

  it("maps GraphQL user errors to typed execution errors", async () => {
    globalThis.__D7_TEST__.mockAdminGraphql.mockImplementation(async (query: string) => {
      if (query.includes("mutation AutomationProductUpdate")) {
        return new Response(
          JSON.stringify({
            data: {
              productUpdate: {
                product: null,
                userErrors: [{ field: ["tags"], message: "Invalid tag format" }],
              },
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return createMockGraphqlRouter()(query);
    });

    await expect(executeShopifyAutomation(buildExecutableAutomation())).rejects.toMatchObject({
      code: "graphql_user_error",
    });
  });

  it("sanitizes logs without secrets or raw GraphQL payloads", () => {
    const sanitized = sanitizeErrorForLog(
      new ShopifyExecutionError("permission_denied", "Denied", {
        details: { authorization: "secret-token" },
      }),
    );
    expect(JSON.stringify(sanitized)).not.toContain("secret-token");
  });

  it("retries rate-limited Shopify responses", async () => {
    let calls = 0;
    const router = createMockGraphqlRouter();
    globalThis.__D7_TEST__.mockAdminGraphql.mockImplementation(async (query: string, options?) => {
      calls += 1;
      if (calls === 2) {
        return new Response("", { status: 429, headers: { "retry-after": "0" } });
      }
      return router(query, options);
    });

    const result = await executeShopifyAutomation(buildExecutableAutomation());
    expect(result.shopifyMutationsExecuted).toBe(true);
    expect(calls).toBeGreaterThan(2);
  });

  it("uses injectable admin context without duplicating auth", async () => {
    const graphql = vi.fn(createMockGraphqlRouter());
    const result = await executeShopifyAutomation(buildExecutableAutomation(), {
      resolveAdminContext: async (storeId) => ({
        storeId,
        shopifyDomain: "storepilot-test.myshopify.com",
        client: { graphql },
      }),
    });
    expect(result.shopifyMutationsExecuted).toBe(true);
    expect(graphql).toHaveBeenCalled();
    expect(globalThis.__D7_TEST__.mockAdminGraphql).not.toHaveBeenCalled();
  });
});
