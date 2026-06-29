import { describe, expect, it } from "vitest";

import {
  buildClarityAggregateInsightsUrl,
  buildClarityPageInsightsUrl,
  sanitizeClarityPagePath,
} from "../clarity/clarity-query-builder";

describe("Clarity query builder", () => {
  it("builds aggregate and page insight URLs", () => {
    expect(buildClarityAggregateInsightsUrl(3)).toContain("numOfDays=3");
    expect(buildClarityPageInsightsUrl(2)).toContain("dimension1=URL");
    expect(buildClarityPageInsightsUrl(2)).toContain("numOfDays=2");
  });

  it("sanitizes page paths without query strings", () => {
    expect(sanitizeClarityPagePath("https://store.example.com/products/shoe?ref=ad")).toBe(
      "/products/shoe",
    );
    expect(sanitizeClarityPagePath("/collections/all#reviews")).toBe("/collections/all");
  });
});
