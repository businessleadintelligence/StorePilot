import type { StoreAuditFacts } from "../facts/store-audit-facts";
import type {
  StoreAuditEstimatedImpact,
  StoreAuditIntelligenceRecommendationDraft,
} from "../schemas/store-audit-intelligence";
import { estimateAuditImpact } from "../tools/audit-impact-tool";

function sectionScoreForCategory(facts: StoreAuditFacts, category: string): number {
  const mapping: Record<string, number> = {
    Homepage: facts.homepageScore,
    Navigation: facts.navigation.score,
    Collections: facts.collections.score,
    "Product Pages": facts.productPages.score,
    Theme: facts.themeScore,
    Apps: facts.apps.score,
    SEO: facts.seoScore,
    Accessibility: facts.accessibilityScore,
    "Mobile UX": facts.mobileScore,
    "Checkout Preparation": facts.conversionScore,
    "Conversion Optimization": facts.conversionScore,
  };

  return mapping[category] ?? facts.storeHealthScore;
}

export function estimateStoreAuditRecommendationImpactForFacts(
  facts: StoreAuditFacts,
  recommendation: StoreAuditIntelligenceRecommendationDraft,
): StoreAuditEstimatedImpact {
  return estimateAuditImpact({
    category: recommendation.category,
    confidence: recommendation.confidence,
    sectionScore: sectionScoreForCategory(facts, recommendation.category),
  });
}
