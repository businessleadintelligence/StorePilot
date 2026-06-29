import type { StoreAuditFacts } from "../facts/store-audit-facts";
import type { StoreAuditHealthExplanation } from "../schemas/store-audit-intelligence";
import { classifyStoreAuditHealthBand } from "../tools/audit-health-tool";

export function buildStoreAuditHealthExplanation(facts: StoreAuditFacts): StoreAuditHealthExplanation {
  const band = classifyStoreAuditHealthBand(facts.storeHealthScore);
  const drivers = [
    {
      factor: "Homepage",
      direction: facts.homepageScore >= 70 ? ("positive" as const) : ("negative" as const),
      detail: `Homepage score is ${facts.homepageScore}/100`,
    },
    {
      factor: "SEO",
      direction: facts.seoScore >= 70 ? ("positive" as const) : ("negative" as const),
      detail: `SEO score is ${facts.seoScore}/100`,
    },
    {
      factor: "Performance",
      direction: facts.performanceScore >= 70 ? ("positive" as const) : ("negative" as const),
      detail: `Performance score is ${facts.performanceScore}/100`,
    },
    {
      factor: "Conversion",
      direction: facts.conversionScore >= 70 ? ("positive" as const) : ("negative" as const),
      detail: `Conversion score is ${facts.conversionScore}/100`,
    },
  ];

  return {
    score: facts.storeHealthScore,
    summary: `Store audit health is ${band} with ${facts.criticalIssueCount} flagged issue areas.`,
    drivers,
  };
}
