import type { SeoIntelligenceFacts } from "../facts/seo-intelligence-facts";
import type {
  SeoEstimatedImpact,
  SeoIntelligenceRecommendationDraft,
} from "../schemas/seo-intelligence";
import { estimateSeoImpact } from "../tools/seo-impact-tool";

function sectionScoreForCategory(facts: SeoIntelligenceFacts, category: string): number {
  const mapping: Record<string, number> = {
    "Technical SEO": facts.scores.technicalSeoScore,
    Content: facts.scores.contentScore,
    Images: facts.scores.imageOptimizationScore,
    Collections: facts.scores.contentScore,
    Products: facts.scores.contentScore,
    Navigation: facts.scores.internalLinkingScore,
    "Internal Linking": facts.scores.internalLinkingScore,
    "Structured Data": facts.scores.structuredDataScore,
    "Core Web Vitals": facts.scores.coreWebVitalsScore,
    Indexability: facts.scores.indexabilityScore,
    Accessibility: facts.scores.accessibilityScore,
    Schema: facts.scores.structuredDataScore,
    Metadata: facts.scores.contentScore,
    "Merchant Trust": facts.scores.seoScore,
    "Conversion SEO": facts.scores.organicOpportunityScore,
  };

  return mapping[category] ?? facts.seoHealthScore;
}

export function estimateSeoRecommendationImpactForFacts(
  facts: SeoIntelligenceFacts,
  recommendation: SeoIntelligenceRecommendationDraft,
): SeoEstimatedImpact {
  return estimateSeoImpact({
    category: recommendation.category,
    confidence: recommendation.confidence,
    sectionScore: sectionScoreForCategory(facts, recommendation.category),
  });
}
