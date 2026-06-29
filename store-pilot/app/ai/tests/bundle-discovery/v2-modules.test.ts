import { describe, expect, it } from "vitest";

import { enrichBundleDiscoveryOutput } from "../../agents/bundle-discovery-enrichment";
import { buildBundleEvidenceCatalog } from "../../agents/bundle-discovery-evidence";
import { shouldExpireBundleRecommendation } from "../../agents/bundle-discovery-expiration";
import { assignBundleRecommendationGroup } from "../../agents/bundle-discovery-groups";
import { buildBundleHealthExplanation } from "../../agents/bundle-discovery-health";
import { dedupeSimilarBundleRecommendations } from "../../agents/bundle-discovery-similarity";
import { extractBundleDiscoveryRecommendations } from "../../agents/bundle-discovery.validator";
import { runWithBundleDiscoveryContext } from "../../agents/agent-execution-context";
import {
  buildBundleFactsFromSnapshot,
  buildValidBundleDiscoveryDraft,
} from "./helpers";

describe("Bundle Discovery v2 modules", () => {
  it("builds evidence catalog and health explanation", () => {
    const facts = buildBundleFactsFromSnapshot();
    const catalog = buildBundleEvidenceCatalog(facts);
    const health = buildBundleHealthExplanation(facts);

    expect(catalog.some((entry) => entry.key === "bundle_health_score")).toBe(true);
    expect(health.score).toBe(facts.bundleHealthScore);
    expect(health.drivers.length).toBeGreaterThan(0);
  });

  it("dedupes similar recommendations and assigns groups", () => {
    const facts = buildBundleFactsFromSnapshot();
    const output = buildValidBundleDiscoveryDraft(facts);
    const deduped = dedupeSimilarBundleRecommendations(output.recommendations);

    expect(deduped.length).toBeGreaterThan(0);
    expect(
      assignBundleRecommendationGroup({
        category: "Starter Kit",
        priorityScore: 80,
        bundleType: "starter_kit",
      }),
    ).toBe("Top Bundle Opportunities");
  });

  it("enriches bundle output with evidence, groups, and impact", () => {
    const facts = buildBundleFactsFromSnapshot();
    const output = buildValidBundleDiscoveryDraft(facts);
    const enriched = enrichBundleDiscoveryOutput({ facts, output });

    expect(enriched.recommendations[0]?.evidence.length).toBeGreaterThan(0);
    expect(enriched.recommendationGroups.topBundleOpportunities.length).toBeGreaterThan(0);
    expect(enriched.potentialAttachRate).toBe(facts.potentialAttachRate);
  });

  it("respects recommendation memory during extraction", async () => {
    const facts = buildBundleFactsFromSnapshot();
    const output = buildValidBundleDiscoveryDraft(facts);

    const extracted = await runWithBundleDiscoveryContext(
      {
        storeId: "store-1",
        subjectKey: "bundle:store-1",
        recommendationMemory: {
          implementedIds: new Set([output.recommendations[0].id]),
          dismissedIds: new Set(),
          openIds: new Set(),
          snoozedIds: new Set(),
          ignoredIds: new Set(),
        },
      },
      () => extractBundleDiscoveryRecommendations(output),
    );

    expect(extracted.every((item) => item.title !== output.recommendations[0].title)).toBe(true);
  });

  it("expires recommendations when bundle opportunities are resolved", () => {
    const facts = buildBundleFactsFromSnapshot();
    facts.candidateCount = 0;
    facts.bundleHealthScore = 85;
    facts.highConfidenceCount = 0;

    expect(
      shouldExpireBundleRecommendation({
        facts,
        payload: { category: "Starter Kit" },
        status: "open",
      }),
    ).toBe(true);
  });
});
