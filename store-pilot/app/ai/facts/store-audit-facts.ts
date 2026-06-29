import { buildFactFingerprint } from "../cache/fingerprint";
import {
  getBehaviorMetrics,
  getPerformanceMetrics,
  getRevenueMetrics,
} from "../migration/unified-metrics-migration";
import type { UnifiedStoreMetrics } from "../../connectors/normalization/normalized-metrics";
import { analyzeStoreSpeed } from "../tools/store-speed-tool";
import { analyzeImages } from "../tools/image-analysis-tool";
import { analyzePolicies, analyzeMerchantBestPractices } from "../tools/policy-analysis-tool";
import { analyzeTechnicalSeo } from "../tools/technical-seo-tool";
import { analyzeTrustSignals } from "../tools/trust-analysis-tool";
import { auditAccessibility } from "../tools/accessibility-audit-tool";
import { auditApps } from "../tools/app-audit-tool";
import { calculateStoreAuditHealthScore } from "../tools/audit-health-tool";
import { auditCollections } from "../tools/collection-audit-tool";
import { auditConversion } from "../tools/conversion-audit-tool";
import { auditHomepage } from "../tools/homepage-audit-tool";
import { auditMobileUx } from "../tools/mobile-ux-tool";
import { auditNavigation } from "../tools/navigation-audit-tool";
import { auditProductPages } from "../tools/product-page-audit-tool";
import { auditSeo } from "../tools/seo-audit-tool";
import { auditTheme } from "../tools/theme-audit-tool";
import type { FactBuilder, FactBuilderContext } from "./types";

export type StoreAuditHomepageFacts = {
  score: number;
  issues: string[];
  signals: ReturnType<typeof auditHomepage>["signals"];
};

export type StoreAuditNavigationFacts = {
  score: number;
  issues: string[];
  menuDepth: number;
  searchAvailable: boolean;
  footerComplete: boolean;
};

export type StoreAuditCollectionFacts = {
  score: number;
  issues: string[];
  collectionCount: number;
  emptyCollections: number;
  missingDescriptions: number;
};

export type StoreAuditProductPageFacts = {
  score: number;
  issues: string[];
  totalProducts: number;
  shortTitles: number;
  missingPrice: number;
  missingSku: number;
};

export type StoreAuditThemeFacts = {
  score: number;
  issues: string[];
  jsBundleRisk: boolean;
  imageOptimizationScore: number;
};

export type StoreAuditAppFacts = {
  score: number;
  issues: string[];
  installedApps: number;
  unusedApps: number;
  duplicateApps: number;
  recommendations: Array<{ label: string; action: string }>;
};

export type StoreAuditSeoFacts = {
  score: number;
  issues: string[];
  titleCoverage: number;
  descriptionCoverage: number;
  structuredDataLikely: boolean;
};

export type StoreAuditAccessibilityFacts = {
  score: number;
  issues: string[];
  altTextCoverage: number;
};

export type StoreAuditMobileUxFacts = {
  score: number;
  issues: string[];
  touchTargetScore: number;
  stickyCtaLikely: boolean;
};

export type StoreAuditConversionFacts = {
  score: number;
  issues: string[];
  cartFrictionScore: number;
  socialProofScore: number;
  upsellVisibility: number;
};

export type StoreAuditImagesFacts = {
  score: number;
  issues: string[];
  altTextCoverage: number;
  optimizationScore: number;
};

export type StoreAuditTrustFacts = {
  score: number;
  issues: string[];
  socialProofReady: boolean;
  policyReady: boolean;
};

export type StoreAuditPolicyFacts = {
  score: number;
  issues: string[];
  refundPolicyLikely: boolean;
  shippingPolicyLikely: boolean;
  privacyPolicyLikely: boolean;
};

export type StoreAuditTechnicalSeoFacts = {
  score: number;
  issues: string[];
  canonicalRisk: boolean;
  sitemapLikely: boolean;
  structuredDataLikely: boolean;
};

export type StoreAuditMerchantBestPracticesFacts = {
  score: number;
  issues: string[];
  catalogComplete: boolean;
  onboardingComplete: boolean;
};

export type StoreAuditStoreSpeedFacts = {
  score: number;
  issues: string[];
  estimatedPageWeightRisk: boolean;
  syncLatencyRisk: boolean;
};

export type StoreAuditPerformanceFacts = {
  score: number;
  issues: string[];
  themeScore: number;
  appScore: number;
};

export type StoreAuditFacts = {
  storeId: string;
  storeName: string;
  computedAt: string;
  storeHealthScore: number;
  overallAuditScore: number;
  homepageScore: number;
  performanceScore: number;
  navigationScore: number;
  seoScore: number;
  technicalSeoScore: number;
  accessibilityScore: number;
  conversionScore: number;
  mobileScore: number;
  themeScore: number;
  imageOptimizationScore: number;
  trustScore: number;
  policyScore: number;
  appBloatScore: number;
  merchantBestPracticesScore: number;
  criticalIssueCount: number;
  homepage: StoreAuditHomepageFacts;
  navigation: StoreAuditNavigationFacts;
  collections: StoreAuditCollectionFacts;
  productPages: StoreAuditProductPageFacts;
  theme: StoreAuditThemeFacts;
  apps: StoreAuditAppFacts;
  seo: StoreAuditSeoFacts;
  accessibility: StoreAuditAccessibilityFacts;
  mobileUx: StoreAuditMobileUxFacts;
  conversion: StoreAuditConversionFacts;
  performance: StoreAuditPerformanceFacts;
  images: StoreAuditImagesFacts;
  trust: StoreAuditTrustFacts;
  policies: StoreAuditPolicyFacts;
  technicalSeo: StoreAuditTechnicalSeoFacts;
  merchantBestPractices: StoreAuditMerchantBestPracticesFacts;
  storeSpeed: StoreAuditStoreSpeedFacts;
  implementedRecommendationIds: string[];
  dismissedRecommendationIds: string[];
};

export type StoreAuditFactsSource = {
  getStoreAuditSnapshot(input: { storeId: string }): Promise<{
    storeName: string;
    activeProductCount: number;
    draftProductCount: number;
    recentOrderCount: number;
    averageOrderValue: number;
    hasCompletedOnboarding: boolean;
    shortTitles: number;
    missingPrice: number;
    missingSku: number;
    averageTitleLength: number;
    collectionCount: number;
    emptyCollections: number;
    missingCollectionDescriptions: number;
    duplicateCollectionTitles: number;
    missingCollectionImages: number;
    webhookCount: number;
    duplicateWebhookTopics: number;
    staleWebhookCount: number;
    syncLatencyDays: number | null;
    productsWithoutDescriptiveTitles: number;
    headingOrderIssues: number;
    missingAltTextProxy: number;
    duplicateTitles: number;
    productsWithLongTitles: number;
    implementedRecommendationIds: string[];
    dismissedRecommendationIds: string[];
    unifiedMetrics: UnifiedStoreMetrics;
  } | null>;
};

function countCriticalIssues(sections: Array<{ issues: string[] }>): number {
  return sections.reduce((total, section) => total + section.issues.length, 0);
}

export function createStoreAuditFactsBuilder(source: StoreAuditFactsSource): FactBuilder<StoreAuditFacts> {
  return {
    agentId: "store_audit",
    async build(context: FactBuilderContext): Promise<StoreAuditFacts> {
      const snapshot = await source.getStoreAuditSnapshot({ storeId: context.storeId });

      if (!snapshot) {
        throw new Error("store_audit_facts_unavailable");
      }

      const computedAt = new Date().toISOString();
      const homepage = auditHomepage({
        storeName: snapshot.storeName,
        activeProductCount: snapshot.activeProductCount,
        recentOrderCount: snapshot.recentOrderCount,
        hasCompletedOnboarding: snapshot.hasCompletedOnboarding,
      });

      const navigation = auditNavigation({
        collectionCount: snapshot.collectionCount,
        activeProductCount: snapshot.activeProductCount,
        duplicateCollectionTitles: snapshot.duplicateCollectionTitles,
        productsMissingSku: snapshot.missingSku,
      });

      const collections = auditCollections({
        collectionCount: snapshot.collectionCount,
        emptyCollections: snapshot.emptyCollections,
        missingDescriptions: snapshot.missingCollectionDescriptions,
        duplicateCollections: snapshot.duplicateCollectionTitles,
        missingImages: snapshot.missingCollectionImages,
      });

      const productPages = auditProductPages({
        totalProducts: snapshot.activeProductCount,
        shortTitles: snapshot.shortTitles,
        missingPrice: snapshot.missingPrice,
        missingSku: snapshot.missingSku,
        draftProducts: snapshot.draftProductCount,
        averageTitleLength: snapshot.averageTitleLength,
      });

      const theme = auditTheme({
        activeProductCount: snapshot.activeProductCount,
        webhookCount: snapshot.webhookCount,
        largeCatalog: snapshot.activeProductCount > 100,
        syncLatencyDays: snapshot.syncLatencyDays,
      });

      const apps = auditApps({
        webhookCount: snapshot.webhookCount,
        duplicateWebhookTopics: snapshot.duplicateWebhookTopics,
        staleWebhookCount: snapshot.staleWebhookCount,
      });

      const seo = auditSeo({
        productsWithShortTitles: snapshot.shortTitles,
        productsWithLongTitles: snapshot.productsWithLongTitles,
        totalProducts: snapshot.activeProductCount,
        duplicateTitles: snapshot.duplicateTitles,
        missingSku: snapshot.missingSku,
      });

      const accessibility = auditAccessibility({
        productsWithoutDescriptiveTitles: snapshot.productsWithoutDescriptiveTitles,
        shortButtonLabels: snapshot.shortTitles,
        headingOrderIssues: snapshot.headingOrderIssues,
        missingAltTextProxy: snapshot.missingAltTextProxy,
        totalProducts: snapshot.activeProductCount,
      });

      const mobileUx = auditMobileUx({
        averageTitleLength: snapshot.averageTitleLength,
        activeProductCount: snapshot.activeProductCount,
        hasPrimaryCta: homepage.signals.hasPrimaryCta,
        menuDepth: navigation.menuDepth,
      });

      const conversion = auditConversion({
        recentOrderCount: snapshot.recentOrderCount,
        averageOrderValue: snapshot.averageOrderValue,
        activeProductCount: snapshot.activeProductCount,
        draftProducts: snapshot.draftProductCount,
        bundleVisibilityScore: Math.min(100, snapshot.activeProductCount * 5),
      });

      const policies = analyzePolicies({
        hasCompletedOnboarding: snapshot.hasCompletedOnboarding,
        activeProductCount: snapshot.activeProductCount,
        recentOrderCount: snapshot.recentOrderCount,
      });

      const trust = analyzeTrustSignals({
        recentOrderCount: snapshot.recentOrderCount,
        hasCompletedOnboarding: snapshot.hasCompletedOnboarding,
        socialProofScore: conversion.socialProofScore,
        policyScore: policies.score,
        hasPrimaryCta: homepage.signals.hasPrimaryCta,
      });

      const images = analyzeImages({
        missingAltTextProxy: snapshot.missingAltTextProxy,
        totalProducts: snapshot.activeProductCount,
        imageOptimizationScore: theme.imageOptimizationScore,
        largeCatalog: snapshot.activeProductCount > 100,
      });

      const technicalSeo = analyzeTechnicalSeo({
        duplicateTitles: snapshot.duplicateTitles,
        missingSku: snapshot.missingSku,
        totalProducts: snapshot.activeProductCount,
        structuredDataLikely: seo.structuredDataLikely,
        webhookCount: snapshot.webhookCount,
      });

      const merchantBestPractices = analyzeMerchantBestPractices({
        hasCompletedOnboarding: snapshot.hasCompletedOnboarding,
        missingSku: snapshot.missingSku,
        shortTitles: snapshot.shortTitles,
        activeProductCount: snapshot.activeProductCount,
        draftProductCount: snapshot.draftProductCount,
      });

      const storeSpeed = analyzeStoreSpeed({
        activeProductCount: snapshot.activeProductCount,
        webhookCount: snapshot.webhookCount,
        syncLatencyDays: snapshot.syncLatencyDays,
        largeCatalog: snapshot.activeProductCount > 100,
      });
      const performanceMetrics = getPerformanceMetrics(snapshot.unifiedMetrics);
      const behaviorMetrics = getBehaviorMetrics(snapshot.unifiedMetrics);
      const unifiedSpeedScore =
        performanceMetrics.status === "available" && performanceMetrics.value?.speedScore != null
          ? performanceMetrics.value.speedScore
          : null;
      const adjustedStoreSpeedScore =
        unifiedSpeedScore == null
          ? storeSpeed.score
          : Math.round((storeSpeed.score + unifiedSpeedScore) / 2);
      void behaviorMetrics;

      const performanceScore = Math.round((theme.score + apps.score + adjustedStoreSpeedScore) / 3);
      const enrichedCollections = {
        ...collections,
        collectionCount: snapshot.collectionCount,
        emptyCollections: snapshot.emptyCollections,
        missingDescriptions: snapshot.missingCollectionDescriptions,
      };
      const enrichedProductPages = {
        ...productPages,
        totalProducts: snapshot.activeProductCount,
        shortTitles: snapshot.shortTitles,
        missingPrice: snapshot.missingPrice,
        missingSku: snapshot.missingSku,
      };
      const criticalIssueCount = countCriticalIssues([
        homepage,
        navigation,
        enrichedCollections,
        enrichedProductPages,
        theme,
        apps,
        seo,
        accessibility,
        mobileUx,
        conversion,
      ]);

      const storeHealthScore = calculateStoreAuditHealthScore({
        homepageScore: homepage.score,
        performanceScore,
        seoScore: seo.score,
        accessibilityScore: accessibility.score,
        conversionScore: conversion.score,
        mobileScore: mobileUx.score,
        themeScore: theme.score,
        criticalIssueCount,
      });

      return {
        storeId: context.storeId,
        storeName: snapshot.storeName,
        computedAt,
        storeHealthScore,
        overallAuditScore: storeHealthScore,
        homepageScore: homepage.score,
        performanceScore,
        navigationScore: navigation.score,
        seoScore: seo.score,
        technicalSeoScore: technicalSeo.score,
        accessibilityScore: accessibility.score,
        conversionScore: conversion.score,
        mobileScore: mobileUx.score,
        themeScore: theme.score,
        imageOptimizationScore: images.score,
        trustScore: trust.score,
        policyScore: policies.score,
        appBloatScore: apps.score,
        merchantBestPracticesScore: merchantBestPractices.score,
        criticalIssueCount,
        homepage,
        navigation,
        collections: enrichedCollections,
        productPages: enrichedProductPages,
        theme,
        apps,
        seo,
        accessibility,
        mobileUx,
        conversion,
        performance: {
          score: performanceScore,
          issues: [...theme.issues, ...apps.issues, ...storeSpeed.issues],
          themeScore: theme.score,
          appScore: apps.score,
        },
        images,
        trust,
        policies,
        technicalSeo,
        merchantBestPractices,
        storeSpeed,
        implementedRecommendationIds: snapshot.implementedRecommendationIds,
        dismissedRecommendationIds: snapshot.dismissedRecommendationIds,
      };
    },
    fingerprint(facts: StoreAuditFacts) {
      return buildFactFingerprint({
        storeId: facts.storeId,
        computedAt: facts.computedAt,
        storeHealthScore: facts.storeHealthScore,
        criticalIssueCount: facts.criticalIssueCount,
      });
    },
  };
}
