import type { ExecutiveCooFacts } from "../facts/executive-coo-facts";

export type ExecutiveCooEvidenceCatalogEntry = {
  key: string;
  label: string;
  value: string;
  factPath: string;
  section: string;
};

export function buildExecutiveCooEvidenceCatalog(
  facts: ExecutiveCooFacts,
): ExecutiveCooEvidenceCatalogEntry[] {
  const entries: ExecutiveCooEvidenceCatalogEntry[] = [
    {
      key: "operations_health_score",
      label: "Operations health score",
      value: `${facts.operationsHealthScore}/100`,
      factPath: "operationsHealthScore",
      section: "Overview",
    },
    {
      key: "store_health_score",
      label: "Store health score",
      value: `${facts.storeHealthScore}/100`,
      factPath: "storeHealthScore",
      section: "Store Health",
    },
    {
      key: "revenue_opportunity",
      label: "Revenue opportunity",
      value: `${facts.revenueOpportunity}`,
      factPath: "revenueOpportunity",
      section: "Revenue",
    },
    {
      key: "inventory_risk",
      label: "Inventory risk",
      value: `${facts.inventoryRisk}`,
      factPath: "inventoryRisk",
      section: "Inventory",
    },
    {
      key: "growth_score",
      label: "Growth score",
      value: `${facts.growthScore}/100`,
      factPath: "growthScore",
      section: "Growth",
    },
    {
      key: "critical_issue_count",
      label: "Critical issue count",
      value: `${facts.criticalIssueCount}`,
      factPath: "criticalIssueCount",
      section: "Risk Mitigation",
    },
    {
      key: "open_specialist_recommendations",
      label: "Open specialist recommendations",
      value: `${facts.strategySignals.openSpecialistRecommendations}`,
      factPath: "strategySignals.openSpecialistRecommendations",
      section: "Operations",
    },
    {
      key: "aligned_agent_count",
      label: "Aligned agent count",
      value: `${facts.strategySignals.alignedAgentCount}`,
      factPath: "strategySignals.alignedAgentCount",
      section: "Operations",
    },
    {
      key: "conflicting_agent_count",
      label: "Conflicting agent count",
      value: `${facts.strategySignals.conflictingAgentCount}`,
      factPath: "strategySignals.conflictingAgentCount",
      section: "Risk Mitigation",
    },
    {
      key: "revenue_recovery_candidates",
      label: "Revenue recovery candidates",
      value: `${facts.strategySignals.revenueRecoveryCandidates}`,
      factPath: "strategySignals.revenueRecoveryCandidates",
      section: "Revenue",
    },
    {
      key: "growth_acceleration_candidates",
      label: "Growth acceleration candidates",
      value: `${facts.strategySignals.growthAccelerationCandidates}`,
      factPath: "strategySignals.growthAccelerationCandidates",
      section: "Growth",
    },
    {
      key: "immediate_win_count",
      label: "Immediate win count",
      value: `${facts.strategySignals.immediateWinCount}`,
      factPath: "strategySignals.immediateWinCount",
      section: "Quick Wins",
    },
    {
      key: "strategic_opportunity_count",
      label: "Strategic opportunity count",
      value: `${facts.strategySignals.strategicOpportunityCount}`,
      factPath: "strategySignals.strategicOpportunityCount",
      section: "Strategic Planning",
    },
  ];

  for (const snapshot of facts.agentSnapshots) {
    entries.push({
      key: `agent_${snapshot.agentId}_health`,
      label: `${snapshot.agentId} health`,
      value: `${snapshot.healthScore ?? "n/a"}/100`,
      factPath: `agentSnapshots.${snapshot.agentId}.healthScore`,
      section: focusAreaForAgent(snapshot.agentId),
    });
    entries.push({
      key: `agent_${snapshot.agentId}_open_recommendations`,
      label: `${snapshot.agentId} open recommendations`,
      value: `${snapshot.openRecommendationCount}`,
      factPath: `agentSnapshots.${snapshot.agentId}.openRecommendationCount`,
      section: focusAreaForAgent(snapshot.agentId),
    });
  }

  for (const recommendation of facts.specialistRecommendations.slice(0, 12)) {
    entries.push({
      key: `specialist_${recommendation.recommendationId}`,
      label: `${recommendation.agentId} recommendation`,
      value: recommendation.title,
      factPath: `specialistRecommendations.${recommendation.recommendationId}`,
      section: focusAreaForAgent(recommendation.agentId),
    });
  }

  return entries;
}

function focusAreaForAgent(agentId: string): string {
  const mapping: Record<string, string> = {
    product_intelligence: "Product",
    inventory_intelligence: "Inventory",
    bundle_discovery: "Product",
    store_audit: "Store Health",
    trend_intelligence: "Marketing",
    seo_audit: "Marketing",
    pricing_intelligence: "Revenue",
    growth_intelligence: "Growth",
  };

  return mapping[agentId] ?? "Operations";
}

export function resolveExecutiveCooEvidenceFromKeys(
  keys: string[],
  catalog: ExecutiveCooEvidenceCatalogEntry[],
): string[] {
  const catalogMap = new Map(catalog.map((entry) => [entry.key, entry]));
  return keys.map((key) => {
    const entry = catalogMap.get(key);
    if (!entry) throw new Error(`invalid_evidence_key:${key}`);
    return `${entry.label}: ${entry.value}`;
  });
}

export function validateExecutiveCooEvidenceKeys(
  keys: string[],
  catalog: ExecutiveCooEvidenceCatalogEntry[],
): void {
  const catalogMap = new Map(catalog.map((entry) => [entry.key, entry]));
  for (const key of keys) {
    if (!catalogMap.has(key)) throw new Error(`invalid_evidence_key:${key}`);
  }
}

export function sectionScoreForFocusArea(facts: ExecutiveCooFacts, focusArea: string): number {
  const mapping: Record<string, number> = {
    Operations: facts.operationsHealthScore,
    Revenue: Math.max(0, 100 - Math.min(100, facts.revenueOpportunity)),
    Inventory: Math.max(0, 100 - facts.inventoryRisk),
    Growth: facts.growthScore,
    Product: facts.agentSnapshots.find((item) => item.agentId === "product_intelligence")?.healthScore ?? 55,
    Fulfillment: facts.agentSnapshots.find((item) => item.agentId === "inventory_intelligence")?.healthScore ?? 55,
    Marketing:
      facts.agentSnapshots.find((item) => item.agentId === "seo_audit")?.healthScore ??
      facts.agentSnapshots.find((item) => item.agentId === "trend_intelligence")?.healthScore ??
      55,
    "Store Health": facts.storeHealthScore,
    "Risk Mitigation": Math.max(0, 100 - facts.criticalIssueCount * 12),
    "Strategic Planning": facts.strategySignals.strategicOpportunityCount >= 2 ? 70 : 45,
  };

  return mapping[focusArea] ?? facts.operationsHealthScore;
}
