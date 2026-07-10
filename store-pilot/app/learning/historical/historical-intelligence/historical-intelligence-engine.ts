import prisma from "../../../db.server";
import { computeGraphStatistics } from "../../../knowledge/graph/metrics/graph-metrics";
import { createGraphNodeStore } from "../../../knowledge/graph/nodes/node-store";
import { aggregateHistoricalStoreData } from "../aggregation/historical-aggregator";
import {
  buildConfidenceSeeds,
  computeOverallConfidenceFromSeeds,
} from "../confidence-seeds/confidence-seeds";
import { buildBusinessDnaFromHistorical } from "../dna-builder/business-dna-builder";
import { buildMerchantBaselines } from "../history-import/merchant-baselines";
import {
  hashHistoricalSnapshot,
  persistHistoricalIntelligence,
} from "../memory-seeds/historical-memory";
import { buildPatternSeeds } from "../pattern-seeds/pattern-seeds";
import type {
  BusinessMemoryBundle,
  HistoricalIntelligenceInput,
  HistoricalIntelligenceResult,
} from "../shared/types";

export async function runHistoricalIntelligenceEngine(
  input: HistoricalIntelligenceInput,
): Promise<HistoricalIntelligenceResult> {
  const { storeId } = input;

  const [aggregation, evidenceCount, graphStats, readiness, graphDnaNode] =
    await Promise.all([
      aggregateHistoricalStoreData(storeId),
      prisma.evidence.count({ where: { storeId, active: true } }),
      computeGraphStatistics(storeId),
      prisma.learningReadiness.findUnique({ where: { storeId } }),
      loadBusinessDnaNode(storeId),
    ]);

  const baselines = buildMerchantBaselines(aggregation);
  const patterns = buildPatternSeeds(aggregation);

  const bootstrapConfidences: Record<string, number> = {
    inventory: readiness?.inventoryConfidence ?? 50,
    products: readiness?.productsConfidence ?? 50,
    pricing: readiness?.pricingConfidence ?? 45,
    seo: readiness?.seoConfidence ?? 40,
    collections: readiness?.collectionsConfidence ?? 42,
    operations: readiness?.operationsConfidence ?? 48,
    seasonality: readiness?.seasonalityConfidence ?? 25,
  };

  const confidences = buildConfidenceSeeds({
    snapshot: aggregation,
    graphNodeCount: graphStats.totalNodes,
    graphEdgeCount: graphStats.totalEdges,
    evidenceCount,
    bootstrapConfidences,
  });

  const overallConfidencePercent = computeOverallConfidenceFromSeeds(confidences);

  const businessDna = buildBusinessDnaFromHistorical({
    stats: graphStats,
    snapshot: aggregation,
    patternCount: patterns.length,
    overallConfidencePercent,
  });

  if (graphDnaNode) {
    Object.assign(businessDna, {
      graphDnaProfile: graphDnaNode,
    });
  }

  const bundle: BusinessMemoryBundle = {
    storeId,
    baselines,
    patterns,
    confidences,
    businessDna,
    summary: {
      productCount: aggregation.productCount,
      orderCount: aggregation.orderCount,
      evidenceCount,
      graphNodeCount: graphStats.totalNodes,
      graphEdgeCount: graphStats.totalEdges,
    },
  };

  const graphVersion =
    input.graphVersion ??
    (await prisma.knowledgeGraphMetadata.findUnique({ where: { storeId } }))
      ?.currentVersion;

  return persistHistoricalIntelligence(bundle, {
    graphVersion: graphVersion ?? undefined,
    overallConfidencePercent,
  });
}

async function loadBusinessDnaNode(
  storeId: string,
): Promise<Record<string, unknown> | null> {
  const nodes = createGraphNodeStore();
  const node = await nodes.getByCanonicalKey({
    storeId,
    nodeType: "BusinessDNA",
    canonicalKey: storeId,
  });
  return node ? (node.metadata as Record<string, unknown>) : null;
}

export { hashHistoricalSnapshot };
