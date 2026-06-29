import type { BundleFacts } from "../facts/bundle-facts";

export type BundleEvidenceCatalogEntry = {
  key: string;
  label: string;
  value: string;
  factPath: string;
};

export function buildBundleEvidenceCatalog(facts: BundleFacts): BundleEvidenceCatalogEntry[] {
  const entries: BundleEvidenceCatalogEntry[] = [
    {
      key: "bundle_health_score",
      label: "Bundle health score",
      value: `${facts.bundleHealthScore}/100`,
      factPath: "bundleHealthScore",
    },
    {
      key: "candidate_count",
      label: "Bundle candidates",
      value: `${facts.candidateCount}`,
      factPath: "candidateCount",
    },
    {
      key: "high_confidence_count",
      label: "High-confidence bundles",
      value: `${facts.highConfidenceCount}`,
      factPath: "highConfidenceCount",
    },
    {
      key: "average_confidence",
      label: "Average bundle confidence",
      value: `${facts.averageConfidence}`,
      factPath: "averageConfidence",
    },
    {
      key: "potential_attach_rate",
      label: "Potential attach rate",
      value: `${facts.potentialAttachRate}`,
      factPath: "potentialAttachRate",
    },
    {
      key: "potential_inventory_reduction",
      label: "Potential inventory reduction",
      value: `${facts.potentialInventoryReduction} units`,
      factPath: "potentialInventoryReduction",
    },
    {
      key: "dead_inventory_pairs",
      label: "Dead inventory bundle pairs",
      value: `${facts.deadInventoryPairCount}`,
      factPath: "deadInventoryPairCount",
    },
    {
      key: "total_products",
      label: "Tracked products",
      value: `${facts.totalProducts}`,
      factPath: "totalProducts",
    },
  ];

  if (facts.bundleSuccessRate !== null) {
    entries.push({
      key: "bundle_success_rate",
      label: "Bundle success rate",
      value: `${Math.round(facts.bundleSuccessRate * 100)}%`,
      factPath: "bundleSuccessRate",
    });
  }

  for (const candidate of facts.bundleCandidates.slice(0, 8)) {
    entries.push(
      {
        key: `candidate_${candidate.id}_confidence`,
        label: `${candidate.titles.join(" + ")} confidence`,
        value: `${candidate.confidence}`,
        factPath: `bundleCandidates.${candidate.id}.confidence`,
      },
      {
        key: `candidate_${candidate.id}_attach_rate`,
        label: `${candidate.titles.join(" + ")} attach rate`,
        value: `${candidate.attachRate}`,
        factPath: `bundleCandidates.${candidate.id}.attachRate`,
      },
      {
        key: `candidate_${candidate.id}_type`,
        label: `${candidate.titles.join(" + ")} bundle type`,
        value: candidate.bundleType,
        factPath: `bundleCandidates.${candidate.id}.bundleType`,
      },
    );
  }

  for (const pair of facts.coPurchasePairs.slice(0, 6)) {
    entries.push({
      key: `copurchase_${pair.primaryProductId}_${pair.pairedProductId}`,
      label: "Co-purchase frequency",
      value: `${pair.coPurchaseCount} orders (${pair.attachRate} attach rate)`,
      factPath: `coPurchasePairs.${pair.primaryProductId}:${pair.pairedProductId}`,
    });
  }

  return entries;
}

export function resolveBundleEvidenceFromKeys(
  keys: string[],
  catalog: BundleEvidenceCatalogEntry[],
): string[] {
  const catalogMap = new Map(catalog.map((entry) => [entry.key, entry]));

  return keys.map((key) => {
    const entry = catalogMap.get(key);
    if (!entry) {
      throw new Error(`invalid_evidence_key:${key}`);
    }

    return `${entry.label}: ${entry.value}`;
  });
}

export function validateBundleEvidenceKeys(
  keys: string[],
  catalog: BundleEvidenceCatalogEntry[],
): void {
  const catalogMap = new Map(catalog.map((entry) => [entry.key, entry]));

  for (const key of keys) {
    if (!catalogMap.has(key)) {
      throw new Error(`invalid_evidence_key:${key}`);
    }
  }
}
