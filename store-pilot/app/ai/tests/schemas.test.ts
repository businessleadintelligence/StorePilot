import { describe, expect, it } from "vitest";

import { getSchemaByName, schemaRegistry } from "../schemas";

describe("Schema registry", () => {
  it("registers all required structured output schemas", () => {
    expect(Object.keys(schemaRegistry).sort()).toEqual([
      "bundle-intelligence",
      "collaboration",
      "executive-coo",
      "executive-summary",
      "growth-intelligence",
      "inventory-intelligence",
      "pricing-intelligence",
      "product-intelligence",
      "product-recommendation",
      "seo-intelligence",
      "store-audit",
      "store-audit-intelligence",
      "trend-intelligence",
    ]);
  });

  it("returns null for unknown schema names", () => {
    expect(getSchemaByName("unknown-schema")).toBeNull();
  });
});
