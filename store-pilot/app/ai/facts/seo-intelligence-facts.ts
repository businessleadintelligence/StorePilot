import { buildFactFingerprint } from "../cache/fingerprint";
import {
  buildSeoConnectorSnapshotFromUnified,
  getBehaviorMetrics,
  getPerformanceMetrics,
  getSeoMetrics,
  type MigratedSeoConnectorSnapshot,
} from "../migration/unified-metrics-migration";
import type { UnifiedStoreMetrics } from "../../connectors/normalization/normalized-metrics";
import {
  getActiveSeoKnowledgeRules,
  SEO_KNOWLEDGE_RULE_SET_VERSION,
  type SeoKnowledgeRule,
} from "../knowledge/seo-knowledge-layer";
import { analyzeSeoAccessibility } from "../tools/seo-accessibility-tool";
import { analyzeSeoCanonicalHealth } from "../tools/seo-canonical-tool";
import { analyzeSeoContent } from "../tools/seo-content-tool";
import { analyzeSeoCoreWebVitals } from "../tools/seo-core-web-vitals-tool";
import { analyzeSeoDuplicateContent } from "../tools/seo-duplicate-content-tool";
import { analyzeSeoHeadingStructure } from "../tools/seo-heading-structure-tool";
import { analyzeSeoImageOptimization } from "../tools/seo-image-optimization-tool";
import { analyzeSeoIndexability } from "../tools/seo-indexability-tool";
import { analyzeSeoInternalLinking } from "../tools/seo-internal-linking-tool";
import { analyzeSeoOrganicOpportunity } from "../tools/seo-organic-opportunity-tool";
import { analyzeSeoPerformance } from "../tools/seo-performance-tool";
import { analyzeSeoSearchVisibility } from "../tools/seo-search-visibility-tool";
import {
  calculateSeoHealthScore,
  calculateSeoIntelligenceScores,
  type SeoIntelligenceScores,
} from "../tools/seo-intelligence-scores-tool";
import { analyzeSeoStructuredData } from "../tools/seo-structured-data-tool";
import { analyzeTechnicalSeo } from "../tools/seo-technical-tool";
import { calculateSeoIntelligenceHealthScore } from "../tools/seo-health-tool";
import type { FactBuilder, FactBuilderContext } from "./types";

export type SeoConnectorSnapshot = Omit<MigratedSeoConnectorSnapshot, "dataStatus">;

export type SeoIntelligenceFacts = {
  storeId: string;
  storeName: string;
  computedAt: string;
  ruleSetVersion: string;
  knowledgeRules: SeoKnowledgeRule[];
  seoHealthScore: number;
  scores: SeoIntelligenceScores;
  criticalIssueCount: number;
  trafficOpportunity: number;
  visibilityOpportunity: number;
  connectors: {
    shopify: { connected: boolean; productCount: number; collectionCount: number };
    googleSearchConsole: { connected: boolean; snapshot: SeoConnectorSnapshot };
    googlePageSpeed: { connected: boolean; snapshot: SeoConnectorSnapshot };
    merchantContent: { connected: boolean; thinPages: number; duplicatePages: number };
  };
  technical: ReturnType<typeof analyzeTechnicalSeo>;
  content: ReturnType<typeof analyzeSeoContent>;
  indexability: ReturnType<typeof analyzeSeoIndexability>;
  internalLinking: ReturnType<typeof analyzeSeoInternalLinking>;
  structuredData: ReturnType<typeof analyzeSeoStructuredData>;
  coreWebVitals: ReturnType<typeof analyzeSeoCoreWebVitals>;
  performance: ReturnType<typeof analyzeSeoPerformance>;
  images: ReturnType<typeof analyzeSeoImageOptimization>;
  accessibility: ReturnType<typeof analyzeSeoAccessibility>;
  duplicateContent: ReturnType<typeof analyzeSeoDuplicateContent>;
  canonical: ReturnType<typeof analyzeSeoCanonicalHealth>;
  headings: ReturnType<typeof analyzeSeoHeadingStructure>;
  searchVisibility: ReturnType<typeof analyzeSeoSearchVisibility>;
  organicOpportunity: ReturnType<typeof analyzeSeoOrganicOpportunity>;
  implementedRecommendationIds: string[];
  dismissedRecommendationIds: string[];
};

export type SeoIntelligenceFactsSource = {
  getSeoIntelligenceSnapshot(input: { storeId: string }): Promise<{
    storeName: string;
    activeProductCount: number;
    shortTitles: number;
    duplicateTitles: number;
    missingAltTextProxy: number;
    thinContentPages: number;
    collectionCount: number;
    missingCollectionDescriptions: number;
    productsWithMetaTitle: number;
    productsWithMetaDescription: number;
    headingOrderIssues: number;
    missingSku: number;
    structuredDataLikely: boolean;
    canonicalIssues: number;
    indexedPagesProxy: number;
    totalPagesProxy: number;
    webhookCount: number;
    syncLatencyDays: number | null;
    unifiedMetrics: UnifiedStoreMetrics;
    implementedRecommendationIds: string[];
    dismissedRecommendationIds: string[];
  } | null>;
};

function countCriticalIssues(sections: Array<{ issues: string[] }>): number {
  return sections.reduce((total, section) => total + section.issues.length, 0);
}

function inferInternalLinkScore(collectionCount: number, activeProductCount: number): number {
  return Math.max(
    0,
    Math.min(100, 50 + collectionCount * 5 + Math.min(30, activeProductCount) - Math.max(0, collectionCount - 6) * 4),
  );
}

export function createSeoIntelligenceFactsBuilder(
  source: SeoIntelligenceFactsSource,
): FactBuilder<SeoIntelligenceFacts> {
  return {
    agentId: "seo_audit",
    async build(context: FactBuilderContext): Promise<SeoIntelligenceFacts> {
      const snapshot = await source.getSeoIntelligenceSnapshot({ storeId: context.storeId });

      if (!snapshot) {
        throw new Error("seo_intelligence_facts_unavailable");
      }

      const computedAt = new Date().toISOString();
      const internalLinkScoreProxy = inferInternalLinkScore(snapshot.collectionCount, snapshot.activeProductCount);
      const connectorSnapshot = buildSeoConnectorSnapshotFromUnified(snapshot.unifiedMetrics, {
        indexedPagesProxy: snapshot.indexedPagesProxy,
        coverageIssues: Math.max(0, snapshot.totalPagesProxy - snapshot.indexedPagesProxy),
      });
      const seoMetrics = getSeoMetrics(snapshot.unifiedMetrics);
      const performanceMetrics = getPerformanceMetrics(snapshot.unifiedMetrics);
      void getBehaviorMetrics(snapshot.unifiedMetrics);

      const technical = analyzeTechnicalSeo({
        duplicateTitles: snapshot.duplicateTitles,
        canonicalIssues: snapshot.canonicalIssues,
        structuredDataLikely: snapshot.structuredDataLikely,
        headingOrderIssues: snapshot.headingOrderIssues,
      });

      const content = analyzeSeoContent({
        totalProducts: snapshot.activeProductCount,
        productsWithShortTitles: snapshot.shortTitles,
        thinContentPages: snapshot.thinContentPages,
        missingCollectionDescriptions: snapshot.missingCollectionDescriptions,
        collectionCount: snapshot.collectionCount,
      });

      const indexability = analyzeSeoIndexability({
        indexedPagesProxy: snapshot.indexedPagesProxy,
        totalPagesProxy: snapshot.totalPagesProxy,
        canonicalIssues: snapshot.canonicalIssues,
      });

      const internalLinking = analyzeSeoInternalLinking({
        collectionCount: snapshot.collectionCount,
        activeProductCount: snapshot.activeProductCount,
        navigationDepthProxy: Math.max(1, Math.ceil(snapshot.collectionCount / 3)),
      });

      const structuredData = analyzeSeoStructuredData({
        structuredDataLikely: snapshot.structuredDataLikely,
        totalProducts: snapshot.activeProductCount,
      });

      const coreWebVitals = analyzeSeoCoreWebVitals({
        lcpScore: connectorSnapshot.lcpScore,
        clsScore: connectorSnapshot.clsScore,
        inpScore: connectorSnapshot.inpScore,
      });

      const performance = analyzeSeoPerformance({
        syncLatencyDays: snapshot.syncLatencyDays,
        webhookCount: snapshot.webhookCount,
      });

      const images = analyzeSeoImageOptimization({
        missingAltTextProxy: snapshot.missingAltTextProxy,
        totalProducts: snapshot.activeProductCount,
      });

      const accessibility = analyzeSeoAccessibility({
        missingAltTextProxy: snapshot.missingAltTextProxy,
        headingOrderIssues: snapshot.headingOrderIssues,
        totalProducts: snapshot.activeProductCount,
      });

      const duplicateContent = analyzeSeoDuplicateContent({
        duplicateTitles: snapshot.duplicateTitles,
        thinContentPages: snapshot.thinContentPages,
      });

      const canonical = analyzeSeoCanonicalHealth({
        duplicateTitles: snapshot.duplicateTitles,
        missingSku: snapshot.missingSku,
      });

      const headings = analyzeSeoHeadingStructure({
        headingOrderIssues: snapshot.headingOrderIssues,
      });

      const searchVisibility = analyzeSeoSearchVisibility({
        averagePositionProxy: connectorSnapshot.averagePositionProxy,
        averageCtrProxy: connectorSnapshot.averageCtrProxy,
        impressionsProxy: connectorSnapshot.impressionsProxy,
      });

      const scores = calculateSeoIntelligenceScores({
        totalProducts: snapshot.activeProductCount,
        productsWithMetaTitle: snapshot.productsWithMetaTitle,
        productsWithMetaDescription: snapshot.productsWithMetaDescription,
        productsWithShortTitles: snapshot.shortTitles,
        duplicateTitles: snapshot.duplicateTitles,
        missingAltTextProxy: snapshot.missingAltTextProxy,
        thinContentPages: snapshot.thinContentPages,
        collectionCount: snapshot.collectionCount,
        missingCollectionDescriptions: snapshot.missingCollectionDescriptions,
        internalLinkScoreProxy,
        structuredDataLikely: snapshot.structuredDataLikely,
        canonicalIssues: snapshot.canonicalIssues,
        indexedPagesProxy: snapshot.indexedPagesProxy,
        totalPagesProxy: snapshot.totalPagesProxy,
        headingOrderIssues: snapshot.headingOrderIssues,
        lcpScore: connectorSnapshot.lcpScore,
        clsScore: connectorSnapshot.clsScore,
        inpScore: connectorSnapshot.inpScore,
        performanceScore: performance.score,
        accessibilityScore: accessibility.score,
        searchVisibilityProxy: searchVisibility.score,
        averageCtrProxy: connectorSnapshot.averageCtrProxy,
        averagePositionProxy: connectorSnapshot.averagePositionProxy,
      });

      const organicOpportunity = analyzeSeoOrganicOpportunity({
        contentScore: scores.contentScore,
        technicalSeoScore: scores.technicalSeoScore,
        searchVisibilityScore: scores.searchVisibilityScore,
        coreWebVitalsScore: scores.coreWebVitalsScore,
      });

      const criticalIssueCount = countCriticalIssues([
        technical,
        content,
        indexability,
        internalLinking,
        structuredData,
        coreWebVitals,
        performance,
        images,
        accessibility,
        duplicateContent,
        canonical,
        headings,
        searchVisibility,
      ]);

      const seoHealthScore = calculateSeoIntelligenceHealthScore({
        scores,
        criticalIssueCount,
      });

      const trafficOpportunity = Math.round(
        organicOpportunity.score * 12 + Math.max(0, 100 - scores.searchVisibilityScore) * 4,
      );
      const visibilityOpportunity = Math.round(
        Math.max(0, 100 - scores.searchVisibilityScore) * 1.5 + connectorSnapshot.impressionsProxy / 10,
      );

      return {
        storeId: context.storeId,
        storeName: snapshot.storeName,
        computedAt,
        ruleSetVersion: SEO_KNOWLEDGE_RULE_SET_VERSION,
        knowledgeRules: getActiveSeoKnowledgeRules(),
        seoHealthScore,
        scores,
        criticalIssueCount,
        trafficOpportunity,
        visibilityOpportunity,
        connectors: {
          shopify: {
            connected: true,
            productCount: snapshot.activeProductCount,
            collectionCount: snapshot.collectionCount,
          },
          googleSearchConsole: {
            connected: seoMetrics.status === "available",
            snapshot: connectorSnapshot,
          },
          googlePageSpeed: {
            connected: performanceMetrics.status === "available",
            snapshot: connectorSnapshot,
          },
          merchantContent: {
            connected: true,
            thinPages: snapshot.thinContentPages,
            duplicatePages: snapshot.duplicateTitles,
          },
        },
        technical,
        content,
        indexability,
        internalLinking,
        structuredData,
        coreWebVitals,
        performance,
        images,
        accessibility,
        duplicateContent,
        canonical,
        headings,
        searchVisibility,
        organicOpportunity,
        implementedRecommendationIds: snapshot.implementedRecommendationIds,
        dismissedRecommendationIds: snapshot.dismissedRecommendationIds,
      };
    },
    fingerprint(facts: SeoIntelligenceFacts) {
      return buildFactFingerprint({
        storeId: facts.storeId,
        computedAt: facts.computedAt,
        ruleSetVersion: facts.ruleSetVersion,
        seoHealthScore: facts.seoHealthScore,
        criticalIssueCount: facts.criticalIssueCount,
      });
    },
  };
}
