import type { BundleFacts } from "../facts/bundle-facts";
import type { BundleHealthExplanation } from "../schemas/bundle-intelligence";

export function buildBundleHealthExplanation(facts: BundleFacts): BundleHealthExplanation {
  const drivers: BundleHealthExplanation["drivers"] = [];

  if (facts.highConfidenceCount > 0) {
    drivers.push({
      factor: "High-confidence bundles",
      direction: "positive",
      detail: `${facts.highConfidenceCount} bundle candidates exceed the high-confidence threshold.`,
    });
  }

  if (facts.deadInventoryPairCount > 0) {
    drivers.push({
      factor: "Dead inventory recovery",
      direction: "positive",
      detail: `${facts.deadInventoryPairCount} pairs can recover slow-moving inventory through bundling.`,
    });
  }

  if (facts.candidateCount === 0) {
    drivers.push({
      factor: "Limited bundle signals",
      direction: "negative",
      detail: "No qualifying bundle candidates were detected from synchronized order data.",
    });
  }

  if (facts.potentialInventoryReduction > 0) {
    drivers.push({
      factor: "Inventory reduction",
      direction: "positive",
      detail: `Bundling could reduce about ${facts.potentialInventoryReduction} slow-moving units.`,
    });
  }

  if (facts.potentialAttachRate >= 0.35) {
    drivers.push({
      factor: "Attach rate",
      direction: "positive",
      detail: `Potential attach rate is ${facts.potentialAttachRate} across top candidates.`,
    });
  }

  const negativeCount = drivers.filter((driver) => driver.direction === "negative").length;
  const summary =
    negativeCount >= 1 && facts.candidateCount === 0
      ? "Bundle discovery is limited until stronger co-purchase or relationship signals appear."
      : facts.highConfidenceCount >= 2
        ? "Bundle health is supported by multiple high-confidence merchandising opportunities."
        : "Bundle health reflects mixed merchandising signals across the catalog.";

  return {
    score: facts.bundleHealthScore,
    summary,
    drivers,
  };
}
