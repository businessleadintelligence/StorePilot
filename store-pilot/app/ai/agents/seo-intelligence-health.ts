import type { SeoIntelligenceFacts } from "../facts/seo-intelligence-facts";
import { buildSeoHealthExplanation } from "../tools/seo-health-tool";

export function buildSeoIntelligenceHealthExplanation(facts: SeoIntelligenceFacts) {
  return buildSeoHealthExplanation({
    seoHealthScore: facts.seoHealthScore,
    scores: facts.scores,
    criticalIssueCount: facts.criticalIssueCount,
  });
}
