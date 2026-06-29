import { describe, expect, it } from "vitest";

import {
  buildCacheFingerprint,
  buildFactFingerprint,
  buildRecommendationStableId,
  buildSubjectKey,
} from "../cache/fingerprint";

describe("AI cache fingerprinting", () => {
  it("builds stable fact fingerprints excluding computedAt", () => {
    const first = buildFactFingerprint({
      productId: "p1",
      velocity: 9.3,
      computedAt: "2026-01-01T00:00:00.000Z",
    });
    const second = buildFactFingerprint({
      productId: "p1",
      velocity: 9.3,
      computedAt: "2026-01-02T00:00:00.000Z",
    });

    expect(first).toBe(second);
  });

  it("changes cache fingerprint when prompt version changes", () => {
    const base = {
      agentId: "product_intelligence",
      storeId: "store-1",
      subjectKey: buildSubjectKey("product_intelligence", { productId: "p1" }),
      factFingerprint: buildFactFingerprint({ productId: "p1", velocity: 1 }),
      promptChecksum: "abc123",
    };

    const v1 = buildCacheFingerprint({ ...base, promptVersion: "1.0.0" });
    const v2 = buildCacheFingerprint({ ...base, promptVersion: "1.0.1" });

    expect(v1).not.toBe(v2);
  });

  it("builds stable recommendation ids", () => {
    const first = buildRecommendationStableId({
      storeId: "store-1",
      agentId: "product_intelligence",
      subjectKey: "product:p1",
      category: "inventory",
      title: "Restock SKU",
    });
    const second = buildRecommendationStableId({
      storeId: "store-1",
      agentId: "product_intelligence",
      subjectKey: "product:p1",
      category: "inventory",
      title: "restock sku",
    });

    expect(first).toBe(second);
  });
});
