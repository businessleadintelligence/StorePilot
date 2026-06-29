import { z } from "zod";

import {
  collaborationSchema,
  type CollaborationOutputSchema,
} from "./collaboration";

import {
  productIntelligenceSchema,
  productIntelligenceEnrichedSchema,
  productIntelligenceRecommendationSchema,
  productIntelligenceRecommendationDraftSchema,
  productIntelligenceFindingSchema,
  healthExplanationSchema,
  recommendationGroupsSchema,
  estimatedImpactSchema,
  verificationSchema,
  PRODUCT_INTELLIGENCE_CATEGORIES,
  PRODUCT_INTELLIGENCE_GROUPS,
  PRODUCT_INTELLIGENCE_DIFFICULTIES,
  type ProductIntelligenceOutput,
  type ProductIntelligenceEnrichedOutput,
  type ProductIntelligenceRecommendation,
  type ProductIntelligenceRecommendationDraft,
  type ProductIntelligenceCategory,
  type HealthExplanation,
} from "./product-intelligence";
import {
  inventoryIntelligenceSchema,
  inventoryIntelligenceEnrichedSchema,
  inventoryIntelligenceRecommendationSchema,
  inventoryIntelligenceRecommendationDraftSchema,
  inventoryEstimatedImpactSchema,
  inventoryVerificationSchema,
  INVENTORY_INTELLIGENCE_CATEGORIES,
  INVENTORY_INTELLIGENCE_GROUPS,
  INVENTORY_INTELLIGENCE_DIFFICULTIES,
  type InventoryIntelligenceOutput,
  type InventoryIntelligenceEnrichedOutput,
  type InventoryIntelligenceRecommendation,
  type InventoryIntelligenceRecommendationDraft,
  type InventoryIntelligenceCategory,
  type InventoryHealthExplanation,
} from "./inventory-intelligence";
import {
  bundleIntelligenceSchema,
  bundleIntelligenceEnrichedSchema,
  bundleIntelligenceRecommendationSchema,
  bundleIntelligenceRecommendationDraftSchema,
  bundleEstimatedImpactSchema,
  bundleVerificationSchema,
  BUNDLE_INTELLIGENCE_CATEGORIES,
  BUNDLE_INTELLIGENCE_GROUPS,
  BUNDLE_INTELLIGENCE_DIFFICULTIES,
  type BundleIntelligenceOutput,
  type BundleIntelligenceEnrichedOutput,
  type BundleIntelligenceRecommendation,
  type BundleIntelligenceRecommendationDraft,
  type BundleIntelligenceCategory,
  type BundleHealthExplanation,
} from "./bundle-intelligence";
import {
  storeAuditIntelligenceSchema,
  storeAuditIntelligenceEnrichedSchema,
  storeAuditIntelligenceRecommendationSchema,
  storeAuditIntelligenceRecommendationDraftSchema,
  storeAuditEstimatedImpactSchema,
  storeAuditVerificationSchema,
  STORE_AUDIT_INTELLIGENCE_CATEGORIES,
  STORE_AUDIT_INTELLIGENCE_GROUPS,
  STORE_AUDIT_INTELLIGENCE_DIFFICULTIES,
  type StoreAuditIntelligenceOutput,
  type StoreAuditIntelligenceEnrichedOutput,
  type StoreAuditIntelligenceRecommendation,
  type StoreAuditIntelligenceRecommendationDraft,
  type StoreAuditIntelligenceCategory,
  type StoreAuditHealthExplanation,
} from "./store-audit-intelligence";
import {
  trendIntelligenceSchema,
  trendIntelligenceEnrichedSchema,
  trendIntelligenceRecommendationSchema,
  trendIntelligenceRecommendationDraftSchema,
  trendEstimatedImpactSchema,
  trendVerificationSchema,
  TREND_INTELLIGENCE_CATEGORIES,
  TREND_INTELLIGENCE_GROUPS,
  TREND_INTELLIGENCE_DIFFICULTIES,
  type TrendIntelligenceOutput,
  type TrendIntelligenceEnrichedOutput,
  type TrendIntelligenceRecommendation,
  type TrendIntelligenceRecommendationDraft,
  type TrendIntelligenceCategory,
  type TrendHealthExplanation,
} from "./trend-intelligence";
import {
  seoIntelligenceSchema,
  seoIntelligenceEnrichedSchema,
  seoIntelligenceRecommendationSchema,
  seoIntelligenceRecommendationDraftSchema,
  seoEstimatedImpactSchema,
  seoVerificationSchema,
  SEO_INTELLIGENCE_CATEGORIES,
  SEO_INTELLIGENCE_GROUPS,
  SEO_INTELLIGENCE_DIFFICULTIES,
  type SeoIntelligenceOutput,
  type SeoIntelligenceEnrichedOutput,
  type SeoIntelligenceRecommendation,
  type SeoIntelligenceRecommendationDraft,
  type SeoIntelligenceCategory,
  type SeoHealthExplanation,
} from "./seo-intelligence";
import {
  pricingIntelligenceSchema,
  pricingIntelligenceEnrichedSchema,
  pricingIntelligenceRecommendationSchema,
  pricingIntelligenceRecommendationDraftSchema,
  pricingEstimatedImpactSchema,
  pricingVerificationSchema,
  PRICING_INTELLIGENCE_CATEGORIES,
  PRICING_INTELLIGENCE_GROUPS,
  PRICING_INTELLIGENCE_DIFFICULTIES,
  type PricingIntelligenceOutput,
  type PricingIntelligenceEnrichedOutput,
  type PricingIntelligenceRecommendation,
  type PricingIntelligenceRecommendationDraft,
  type PricingIntelligenceCategory,
  type PricingHealthExplanation,
} from "./pricing-intelligence";
import {
  growthIntelligenceSchema,
  growthIntelligenceEnrichedSchema,
  growthIntelligenceRecommendationSchema,
  growthIntelligenceRecommendationDraftSchema,
  growthEstimatedImpactSchema,
  growthVerificationSchema,
  GROWTH_INTELLIGENCE_CATEGORIES,
  GROWTH_INTELLIGENCE_GROUPS,
  GROWTH_INTELLIGENCE_DIFFICULTIES,
  type GrowthIntelligenceOutput,
  type GrowthIntelligenceEnrichedOutput,
  type GrowthIntelligenceRecommendation,
  type GrowthIntelligenceRecommendationDraft,
  type GrowthIntelligenceCategory,
  type GrowthHealthExplanation,
} from "./growth-intelligence";
import {
  executiveCooSchema,
  executiveCooEnrichedSchema,
  executiveCooTopPrioritySchema,
  executiveCooTopPriorityDraftSchema,
  executiveCooEstimatedImpactSchema,
  executiveCooVerificationSchema,
  EXECUTIVE_COO_FOCUS_AREAS,
  EXECUTIVE_COO_GROUPS,
  EXECUTIVE_COO_DIFFICULTIES,
  type ExecutiveCooOutput,
  type ExecutiveCooEnrichedOutput,
  type ExecutiveCooTopPriority,
  type ExecutiveCooTopPriorityDraft,
  type ExecutiveCooFocusArea,
  type ExecutiveCooHealthExplanation,
} from "./executive-coo";

export const productRecommendationSchema = z.object({
  recommendation: z.string().min(1),
  confidence: z.number().min(0).max(1),
  impact: z.string().min(1),
  reasoning: z.string().min(1),
  priority: z.number().int().min(1).max(5),
});

export type ProductRecommendationOutput = z.infer<typeof productRecommendationSchema>;

export const storeAuditIssueSchema = z.object({
  id: z.string().min(1),
  category: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  severity: z.enum(["low", "medium", "high", "critical"]),
  confidence: z.number().min(0).max(1),
});

export const storeAuditRecommendationSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  action: z.string().min(1),
  priority: z.number().int().min(1).max(5),
  confidence: z.number().min(0).max(1),
  impact: z.string().min(1),
});

export const storeAuditSchema = z.object({
  issues: z.array(storeAuditIssueSchema),
  recommendations: z.array(storeAuditRecommendationSchema),
  score: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
});

export type StoreAuditOutput = z.infer<typeof storeAuditSchema>;

export const executiveSummarySchema = z.object({
  priorities: z.array(z.string().min(1)).min(1),
  risks: z.array(z.string().min(1)),
  opportunities: z.array(z.string().min(1)),
  executiveSummary: z.string().min(1),
});

export type ExecutiveSummaryOutput = z.infer<typeof executiveSummarySchema>;

export {
  productIntelligenceSchema,
  productIntelligenceEnrichedSchema,
  productIntelligenceRecommendationSchema,
  productIntelligenceRecommendationDraftSchema,
  productIntelligenceFindingSchema,
  healthExplanationSchema,
  recommendationGroupsSchema,
  estimatedImpactSchema,
  verificationSchema,
  PRODUCT_INTELLIGENCE_CATEGORIES,
  PRODUCT_INTELLIGENCE_GROUPS,
  PRODUCT_INTELLIGENCE_DIFFICULTIES,
  type ProductIntelligenceOutput,
  type ProductIntelligenceEnrichedOutput,
  type ProductIntelligenceRecommendation,
  type ProductIntelligenceRecommendationDraft,
  type ProductIntelligenceCategory,
  type HealthExplanation,
};

export {
  inventoryIntelligenceSchema,
  inventoryIntelligenceEnrichedSchema,
  inventoryIntelligenceRecommendationSchema,
  inventoryIntelligenceRecommendationDraftSchema,
  inventoryEstimatedImpactSchema,
  inventoryVerificationSchema,
  INVENTORY_INTELLIGENCE_CATEGORIES,
  INVENTORY_INTELLIGENCE_GROUPS,
  INVENTORY_INTELLIGENCE_DIFFICULTIES,
  type InventoryIntelligenceOutput,
  type InventoryIntelligenceEnrichedOutput,
  type InventoryIntelligenceRecommendation,
  type InventoryIntelligenceRecommendationDraft,
  type InventoryIntelligenceCategory,
  type InventoryHealthExplanation,
};

export {
  bundleIntelligenceSchema,
  bundleIntelligenceEnrichedSchema,
  bundleIntelligenceRecommendationSchema,
  bundleIntelligenceRecommendationDraftSchema,
  bundleEstimatedImpactSchema,
  bundleVerificationSchema,
  BUNDLE_INTELLIGENCE_CATEGORIES,
  BUNDLE_INTELLIGENCE_GROUPS,
  BUNDLE_INTELLIGENCE_DIFFICULTIES,
  type BundleIntelligenceOutput,
  type BundleIntelligenceEnrichedOutput,
  type BundleIntelligenceRecommendation,
  type BundleIntelligenceRecommendationDraft,
  type BundleIntelligenceCategory,
  type BundleHealthExplanation,
};

export {
  storeAuditIntelligenceSchema,
  storeAuditIntelligenceEnrichedSchema,
  storeAuditIntelligenceRecommendationSchema,
  storeAuditIntelligenceRecommendationDraftSchema,
  storeAuditEstimatedImpactSchema,
  storeAuditVerificationSchema,
  STORE_AUDIT_INTELLIGENCE_CATEGORIES,
  STORE_AUDIT_INTELLIGENCE_GROUPS,
  STORE_AUDIT_INTELLIGENCE_DIFFICULTIES,
  type StoreAuditIntelligenceOutput,
  type StoreAuditIntelligenceEnrichedOutput,
  type StoreAuditIntelligenceRecommendation,
  type StoreAuditIntelligenceRecommendationDraft,
  type StoreAuditIntelligenceCategory,
  type StoreAuditHealthExplanation,
};

export {
  trendIntelligenceSchema,
  trendIntelligenceEnrichedSchema,
  trendIntelligenceRecommendationSchema,
  trendIntelligenceRecommendationDraftSchema,
  trendEstimatedImpactSchema,
  trendVerificationSchema,
  TREND_INTELLIGENCE_CATEGORIES,
  TREND_INTELLIGENCE_GROUPS,
  TREND_INTELLIGENCE_DIFFICULTIES,
  type TrendIntelligenceOutput,
  type TrendIntelligenceEnrichedOutput,
  type TrendIntelligenceRecommendation,
  type TrendIntelligenceRecommendationDraft,
  type TrendIntelligenceCategory,
  type TrendHealthExplanation,
};

export {
  seoIntelligenceSchema,
  seoIntelligenceEnrichedSchema,
  seoIntelligenceRecommendationSchema,
  seoIntelligenceRecommendationDraftSchema,
  seoEstimatedImpactSchema,
  seoVerificationSchema,
  SEO_INTELLIGENCE_CATEGORIES,
  SEO_INTELLIGENCE_GROUPS,
  SEO_INTELLIGENCE_DIFFICULTIES,
  type SeoIntelligenceOutput,
  type SeoIntelligenceEnrichedOutput,
  type SeoIntelligenceRecommendation,
  type SeoIntelligenceRecommendationDraft,
  type SeoIntelligenceCategory,
  type SeoHealthExplanation,
};

export {
  pricingIntelligenceSchema,
  pricingIntelligenceEnrichedSchema,
  pricingIntelligenceRecommendationSchema,
  pricingIntelligenceRecommendationDraftSchema,
  pricingEstimatedImpactSchema,
  pricingVerificationSchema,
  PRICING_INTELLIGENCE_CATEGORIES,
  PRICING_INTELLIGENCE_GROUPS,
  PRICING_INTELLIGENCE_DIFFICULTIES,
  type PricingIntelligenceOutput,
  type PricingIntelligenceEnrichedOutput,
  type PricingIntelligenceRecommendation,
  type PricingIntelligenceRecommendationDraft,
  type PricingIntelligenceCategory,
  type PricingHealthExplanation,
};

export {
  growthIntelligenceSchema,
  growthIntelligenceEnrichedSchema,
  growthIntelligenceRecommendationSchema,
  growthIntelligenceRecommendationDraftSchema,
  growthEstimatedImpactSchema,
  growthVerificationSchema,
  GROWTH_INTELLIGENCE_CATEGORIES,
  GROWTH_INTELLIGENCE_GROUPS,
  GROWTH_INTELLIGENCE_DIFFICULTIES,
  type GrowthIntelligenceOutput,
  type GrowthIntelligenceEnrichedOutput,
  type GrowthIntelligenceRecommendation,
  type GrowthIntelligenceRecommendationDraft,
  type GrowthIntelligenceCategory,
  type GrowthHealthExplanation,
};

export {
  executiveCooSchema,
  executiveCooEnrichedSchema,
  executiveCooTopPrioritySchema,
  executiveCooTopPriorityDraftSchema,
  executiveCooEstimatedImpactSchema,
  executiveCooVerificationSchema,
  EXECUTIVE_COO_FOCUS_AREAS,
  EXECUTIVE_COO_GROUPS,
  EXECUTIVE_COO_DIFFICULTIES,
  type ExecutiveCooOutput,
  type ExecutiveCooEnrichedOutput,
  type ExecutiveCooTopPriority,
  type ExecutiveCooTopPriorityDraft,
  type ExecutiveCooFocusArea,
  type ExecutiveCooHealthExplanation,
};

export const schemaRegistry = {
  "product-recommendation": productRecommendationSchema,
  "store-audit": storeAuditSchema,
  "executive-summary": executiveSummarySchema,
  "product-intelligence": productIntelligenceSchema,
  "inventory-intelligence": inventoryIntelligenceSchema,
  "bundle-intelligence": bundleIntelligenceSchema,
  "store-audit-intelligence": storeAuditIntelligenceSchema,
  "trend-intelligence": trendIntelligenceSchema,
  "seo-intelligence": seoIntelligenceSchema,
  "pricing-intelligence": pricingIntelligenceSchema,
  "growth-intelligence": growthIntelligenceSchema,
  "executive-coo": executiveCooSchema,
  collaboration: collaborationSchema,
} as const;

export type RegisteredSchemaName = keyof typeof schemaRegistry;

export function getSchemaByName(name: string): z.ZodTypeAny | null {
  if (name in schemaRegistry) {
    return schemaRegistry[name as RegisteredSchemaName];
  }

  return null;
}
