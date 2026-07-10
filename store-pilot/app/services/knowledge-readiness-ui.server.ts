import { getIntelligenceDomainReadiness, getKnowledgeReadiness } from "../knowledge/readiness/knowledge-readiness";

export type KnowledgeReadinessUiData = {
  overallPercent: number;
  lastComputedAt: string | null;
  domains: Array<{
    domain: string;
    label: string;
    percent: number;
  }>;
};

export async function getKnowledgeReadinessForUi(
  storeId: string,
): Promise<KnowledgeReadinessUiData> {
  const [readiness, domains] = await Promise.all([
    getKnowledgeReadiness(storeId),
    getIntelligenceDomainReadiness(storeId),
  ]);

  return {
    overallPercent: readiness?.overallPercent ?? 0,
    lastComputedAt: readiness?.lastComputedAt?.toISOString() ?? null,
    domains: domains.map((entry) => ({
      domain: entry.domain,
      label: entry.label,
      percent: entry.percent,
    })),
  };
}
