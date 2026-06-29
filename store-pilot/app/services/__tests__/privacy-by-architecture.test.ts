import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { AUTOMATION_TEMPLATES } from "../../automation/automation-templates";
import { ORDERS_QUERY } from "../orders.server";
import { ORDER_BY_ID_QUERY } from "../orders.server";
import {
  assertFactsFreeOfCustomerPii,
  findProhibitedPiiFieldPaths,
  MINIMUM_SHOPIFY_SCOPES,
  PROHIBITED_SHOPIFY_SCOPES,
  redactPotentialPiiInText,
  hashIdentifierForLog,
  sanitizeLogContext,
  validateMinimumShopifyScopes,
} from "../../lib/privacy-by-architecture";

const REPO_ROOT = join(process.cwd());
const PRISMA_SCHEMA = readFileSync(join(REPO_ROOT, "prisma", "schema.prisma"), "utf8");
const SHOPIFY_APP_TOML = readFileSync(join(REPO_ROOT, "shopify.app.toml"), "utf8");
const PRIVACY_DOC = readFileSync(join(REPO_ROOT, "docs", "PRIVACY_BY_ARCHITECTURE.md"), "utf8");

const PROMPT_FILES = [
  "product-intelligence.md",
  "inventory-intelligence.md",
  "bundle-discovery.md",
  "store-audit.md",
  "seo-intelligence.md",
  "pricing-intelligence.md",
  "growth-intelligence.md",
  "executive-coo.md",
  "collaboration-engine.md",
  "trend-intelligence.md",
  "platform.template.md",
];

function extractTomlScopes(content: string): string[] {
  const match = content.match(/scopes\s*=\s*"([^"]+)"/);
  if (!match?.[1]) return [];
  return match[1].split(",").map((scope) => scope.trim());
}

describe("Privacy-by-Architecture documentation", () => {
  it("defines the permanent architecture principle", () => {
    expect(PRIVACY_DOC).toContain("Privacy-by-Architecture");
    expect(PRIVACY_DOC).toContain("not a CRM");
    expect(PRIVACY_DOC).toContain("aggregated business metrics");
  });
});

describe("Database privacy audit", () => {
  it("does not define a Customer profile model", () => {
    expect(PRISMA_SCHEMA).not.toMatch(/^model Customer \{/m);
  });

  it("stores orders without customer identity fields", () => {
    expect(PRISMA_SCHEMA).toMatch(/model Order/);
    expect(PRISMA_SCHEMA).not.toMatch(/customerId/);
    expect(PRISMA_SCHEMA).not.toMatch(/customerEmail/);
    expect(PRISMA_SCHEMA).not.toMatch(/shippingAddress/);
  });

  it("keeps CustomerDataExport only for mandatory GDPR compliance", () => {
    expect(PRISMA_SCHEMA).toMatch(/model CustomerDataExport/);
    expect(PRISMA_SCHEMA).toMatch(/shopifyCustomerId/);
    expect(PRISMA_SCHEMA).toMatch(/exportPayload/);
  });

  it("stores merchant staff emails in User model for app auth only", () => {
    expect(PRISMA_SCHEMA).toMatch(/model User/);
    expect(PRISMA_SCHEMA).toMatch(/email\s+String/);
  });

  it("stores AI telemetry without customer fields", () => {
    expect(PRISMA_SCHEMA).toMatch(/model AiExecutionTelemetry/);
    expect(PRISMA_SCHEMA).not.toMatch(/customerId/);
  });
});

describe("Shopify scopes audit", () => {
  const configured = extractTomlScopes(SHOPIFY_APP_TOML);

  it("requests only minimum business-intelligence scopes", () => {
    expect(configured.sort()).toEqual([...MINIMUM_SHOPIFY_SCOPES].sort());
  });

  it("does not request customer or marketing scopes", () => {
    for (const scope of PROHIBITED_SHOPIFY_SCOPES) {
      expect(configured).not.toContain(scope);
    }
  });

  it("removed unused metaobject write scopes", () => {
    expect(configured).not.toContain("write_metaobjects");
    expect(configured).not.toContain("write_metaobject_definitions");
  });

  it("validates scope helper reports no prohibited scopes", () => {
    const result = validateMinimumShopifyScopes(configured.join(","));
    expect(result.prohibited).toEqual([]);
    expect(result.missingRequired).toEqual([]);
  });
});

describe("Webhook audit", () => {
  it("registers operational catalog and order webhooks", () => {
    expect(SHOPIFY_APP_TOML).toContain("products/create");
    expect(SHOPIFY_APP_TOML).toContain("inventory_levels/update");
    expect(SHOPIFY_APP_TOML).toContain("orders/create");
  });

  it("registers mandatory GDPR webhooks only for compliance", () => {
    expect(SHOPIFY_APP_TOML).toContain("customers/data_request");
    expect(SHOPIFY_APP_TOML).toContain("customers/redact");
    expect(SHOPIFY_APP_TOML).toContain("shop/redact");
  });

  it("does not register customer create/update webhooks", () => {
    expect(SHOPIFY_APP_TOML).not.toContain("customers/create");
    expect(SHOPIFY_APP_TOML).not.toContain("customers/update");
  });
});

describe("Order sync privacy", () => {
  it("GraphQL order query excludes customer and address fields", () => {
    expect(ORDERS_QUERY).not.toMatch(/customer/);
    expect(ORDERS_QUERY).not.toMatch(/email/);
    expect(ORDERS_QUERY).not.toMatch(/phone/);
    expect(ORDERS_QUERY).not.toMatch(/shippingAddress/);
    expect(ORDERS_QUERY).not.toMatch(/billingAddress/);
  });

  it("GraphQL order query includes only aggregated commerce fields", () => {
    expect(ORDERS_QUERY).toContain("currentTotalPriceSet");
    expect(ORDERS_QUERY).toContain("lineItems");
    expect(ORDERS_QUERY).toContain("displayFinancialStatus");
  });

  it("GraphQL order-by-id webhook query excludes customer fields", () => {
    expect(ORDER_BY_ID_QUERY).not.toMatch(/customer/);
    expect(ORDER_BY_ID_QUERY).not.toMatch(/email/);
    expect(ORDER_BY_ID_QUERY).not.toMatch(/phone/);
    expect(ORDER_BY_ID_QUERY).not.toMatch(/shippingAddress/);
    expect(ORDER_BY_ID_QUERY).not.toMatch(/billingAddress/);
  });
});

describe("Prompt privacy audit", () => {
  for (const fileName of PROMPT_FILES) {
    it(`includes privacy rules in ${fileName}`, () => {
      const content = readFileSync(join(REPO_ROOT, "app", "ai", "prompts", fileName), "utf8");
      expect(content).toMatch(/Privacy:|not a CRM/);
    });
  }
});

describe("Automation privacy audit", () => {
  it("does not define customer messaging automations", () => {
    for (const template of AUTOMATION_TEMPLATES) {
      const haystack = `${template.id} ${template.name} ${template.description}`.toLowerCase();
      expect(haystack).not.toMatch(/email customer|sms customer|customer profile|customer note/);
    }
  });

  it("limits automation to catalog, merchandising, SEO, pricing, and inventory actions", () => {
    const allowedPatterns = [
      /product|bundle|collection|seo|tag|price|discount|inventory|image|publish|archive|hero|featured|promotion|campaign|compare/,
    ];
    for (const template of AUTOMATION_TEMPLATES) {
      expect(
        allowedPatterns.some((pattern) => pattern.test(`${template.name} ${template.description}`.toLowerCase())),
      ).toBe(true);
    }
  });
});

describe("Privacy helper utilities", () => {
  it("detects prohibited PII field paths in nested facts", () => {
    const paths = findProhibitedPiiFieldPaths({
      storeTotals: { revenue30: 1000 },
      customerEmail: "hidden@example.com",
      nested: { shippingAddress: { city: "Toronto" } },
    });
    expect(paths).toContain("customerEmail");
    expect(paths).toContain("nested.shippingAddress");
  });

  it("assertFactsFreeOfCustomerPii throws on prohibited fields", () => {
    expect(() =>
      assertFactsFreeOfCustomerPii({
        metrics: { orders: 10 },
        phone: "555-0100",
      }),
    ).toThrow("facts_contain_prohibited_pii");
  });

  it("redacts email and phone patterns from log text", () => {
    const redacted = redactPotentialPiiInText("Contact merchant@store.com or 555-123-4567");
    expect(redacted).not.toContain("merchant@store.com");
    expect(redacted).not.toContain("555-123-4567");
    expect(redacted).toContain("[redacted]");
  });

  it("hashes customer identifiers in sanitized log context", () => {
    const sanitized = sanitizeLogContext({
      shopifyCustomerId: "191167",
      storeId: "store-1",
      operation: "customer_data_export_persisted",
    });
    expect(sanitized.shopifyCustomerId).toBeUndefined();
    expect(sanitized.customerIdHash).toMatch(/^[a-f0-9]{16}$/);
    expect(sanitized.storeId).toBe("store-1");
  });

  it("hashIdentifierForLog is stable for correlation", () => {
    expect(hashIdentifierForLog("191167")).toBe(hashIdentifierForLog("191167"));
    expect(hashIdentifierForLog("191167")).not.toBe(hashIdentifierForLog("191168"));
  });
});

describe("Cache and telemetry privacy invariants", () => {
  it("cache fingerprint inputs exclude customer identifiers by design", async () => {
    const { buildCacheFingerprint } = await import("../../ai/cache/fingerprint");
    const fingerprint = buildCacheFingerprint({
      agentId: "product_intelligence",
      storeId: "store-1",
      subjectKey: "product:variant-1",
      factFingerprint: "abc123",
      promptVersion: "1.0.0",
      promptChecksum: "def456",
    });
    expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(fingerprint).not.toContain("customer");
  });
});
