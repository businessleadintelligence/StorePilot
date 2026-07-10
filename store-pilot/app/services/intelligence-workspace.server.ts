import type { LoaderFunctionArgs } from "react-router";

import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import {
  getExecutiveDecisions,
  getOperationsQueue,
} from "../executive/api/executive-api";
import { getExperimentRecommendations, getExperimentUiItems } from "../experiments/api/experiment-api";
import {
  getBusinessStability,
  getPredictionUiItems,
  getPredictions,
} from "../prediction/api/prediction-api";
import {
  getBusinessTimeline,
  getRootCauseTimeline,
  getRootCauseUiItems,
  getRootCauses,
} from "../root-cause/api/root-cause-api";
import {
  getConfidenceEvolution,
  getDecisionJournal,
  getMerchantProfile,
  getMerchantTimeline,
} from "../merchant-intelligence/api/merchant-intelligence-api";
import {
  getConfidenceSeeds,
  getHistoricalMemory,
  getHistoricalSnapshots,
  getLatestBusinessDna,
  getBusinessDnaVersions,
  getPatternSeeds,
} from "../learning/historical/api/historical-api";
import { createKnowledgeGraphApi } from "../knowledge/graph/api/graph-api";
import { getExecutiveDashboardForUi } from "./executive-ui.server";
import { getMerchantIntelligenceDashboardForUi } from "./merchant-intelligence-ui.server";
import { WORKSPACE_ROUTES } from "../intelligence-ui/constants";
import type {
  RelationshipNodeView,
  SearchResultView,
  StoreContext,
  TimelineEventView,
} from "../intelligence-ui/types";
import { jsonArray } from "./intelligence-workspace-ui-helpers";
import type { IntelligenceWorkspaceLoaderData } from "./intelligence-workspace-types";

export type {
  BusinessMemoryWorkspaceData,
  CollectionsWorkspaceData,
  DomainWorkspaceData,
  ExecutiveWorkspaceData,
  ExperimentsWorkspaceData,
  IntelligenceWorkspaceLoaderData,
  IntelligenceWorkspacePayload,
  KnowledgeGraphWorkspaceData,
  MerchantIntelligenceWorkspaceData,
  PredictionsWorkspaceData,
  ProductDetailWorkspaceData,
  ProductsWorkspaceData,
  RootCausesWorkspaceData,
  TimelineWorkspaceData,
} from "./intelligence-workspace-types";

export async function resolveStoreContext(request: Request): Promise<StoreContext | null> {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  if (!shop) return null;

  const store = await prisma.store.findUnique({
    where: { shopifyDomain: shop },
    select: { id: true, currency: true },
  });
  if (!store) return null;

  return { storeId: store.id, currency: store.currency };
}

export async function buildGlobalSearch(storeId: string): Promise<SearchResultView[]> {
  const [products, predictions, experiments, rootCauses, graphResults] = await Promise.all([
    prisma.product.findMany({
      where: { storeId, status: "active" },
      select: { id: true, title: true },
      take: 20,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.prediction.findMany({
      where: { storeId, active: true },
      select: { id: true, title: true },
      take: 20,
      orderBy: { rankScore: "desc" },
    }),
    prisma.experiment.findMany({
      where: { storeId },
      select: { id: true, title: true, status: true },
      take: 20,
      orderBy: { rankScore: "desc" },
    }),
    prisma.rootCause.findMany({
      where: { storeId, active: true },
      select: { id: true, primaryCause: true },
      take: 20,
      orderBy: { rankScore: "desc" },
    }),
    createKnowledgeGraphApi().search({ storeId, query: "", limit: 15 }),
  ]);

  return [
    ...products.map((p) => ({
      id: p.id,
      title: p.title,
      entityType: "Product",
      href: WORKSPACE_ROUTES.productDetail(p.id),
    })),
    ...predictions.map((p) => ({
      id: p.id,
      title: p.title,
      entityType: "Prediction",
      href: WORKSPACE_ROUTES.predictions,
    })),
    ...experiments.map((e) => ({
      id: e.id,
      title: e.title,
      entityType: "Experiment",
      href: WORKSPACE_ROUTES.experiments,
      snippet: e.status,
    })),
    ...rootCauses.map((r) => ({
      id: r.id,
      title: r.primaryCause,
      entityType: "Root Cause",
      href: WORKSPACE_ROUTES.rootCauses,
    })),
    ...graphResults.map((row, index) => ({
      id: row.nodeId ?? `graph-${index}`,
      title: row.searchText.slice(0, 80),
      entityType: "Knowledge Graph",
      href: WORKSPACE_ROUTES.knowledgeGraph,
    })),
  ];
}

export async function buildUnifiedTimeline(storeId: string): Promise<TimelineEventView[]> {
  const [merchantTimeline, rootTimeline, journal] = await Promise.all([
    getMerchantTimeline(storeId, 15),
    getRootCauseTimeline(storeId),
    getDecisionJournal(storeId, 10),
  ]);

  const events: TimelineEventView[] = [
    ...merchantTimeline.map((event) => ({
      id: event.id,
      title: event.title,
      category: event.eventCategory,
      occurredAt: event.occurredAt.toISOString(),
    })),
    ...rootTimeline.map((event) => ({
      id: event.id,
      title: event.rootCause?.primaryCause ?? "Causal event",
      category: "root_cause",
      occurredAt: event.createdAt.toISOString(),
    })),
    ...journal.map((entry) => ({
      id: entry.id,
      title: entry.title,
      category: entry.decisionType,
      occurredAt: entry.createdAt.toISOString(),
    })),
  ];

  return events.sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );
}

export async function buildGraphNodes(storeId: string, limit = 30): Promise<RelationshipNodeView[]> {
  const nodes = await prisma.knowledgeGraphNode.findMany({
    where: { storeId },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  return nodes.map((node) => ({
    id: node.id,
    nodeType: node.nodeType,
    displayName: node.displayName,
    canonicalKey: node.canonicalKey,
    link:
      node.nodeType === "Product"
        ? WORKSPACE_ROUTES.productDetail(node.canonicalKey)
        : WORKSPACE_ROUTES.knowledgeGraph,
  }));
}

async function loadWorkspaceShell(ctx: StoreContext) {
  const [searchResults, timeline] = await Promise.all([
    buildGlobalSearch(ctx.storeId),
    buildUnifiedTimeline(ctx.storeId),
  ]);
  return { searchResults, timeline, currency: ctx.currency };
}

export async function getExecutiveWorkspaceData(ctx: StoreContext): Promise<IntelligenceWorkspaceLoaderData> {
  const shell = await loadWorkspaceShell(ctx);
  const [executive, decisions, queue, stability, merchant, memory] = await Promise.all([
    getExecutiveDashboardForUi(ctx.storeId, ctx.currency),
    getExecutiveDecisions(ctx.storeId),
    getOperationsQueue(ctx.storeId),
    getBusinessStability(ctx.storeId),
    getMerchantIntelligenceDashboardForUi(ctx.storeId),
    getHistoricalMemory(ctx.storeId),
  ]);

  return {
    ...shell,
    workspace: {
      kind: "executive",
      executive,
      decisions,
      queue,
      stabilityScore: stability?.score ?? 0,
      merchant,
      memoryUpdated: memory?.updatedAt?.toISOString() ?? null,
    },
  };
}

export async function getDomainWorkspaceData(
  ctx: StoreContext,
  domain: "inventory" | "pricing" | "seo",
): Promise<IntelligenceWorkspaceLoaderData> {
  const shell = await loadWorkspaceShell(ctx);
  const predictionFilter =
    domain === "inventory"
      ? ["inventory_stockout", "operational_supplier_delay"]
      : domain === "pricing"
        ? ["pricing_margin_risk", "revenue_forecast"]
        : ["seo_traffic_decline"];
  const experimentDomain =
    domain === "inventory" ? "inventory" : domain === "pricing" ? "pricing" : "seo";
  const outcomeFilter =
    domain === "inventory"
      ? ["inventory_shortage"]
      : domain === "pricing"
        ? ["revenue_decrease"]
        : ["traffic_loss"];

  const [predictions, rootCauses, experiments, graphNodes, patterns] = await Promise.all([
    prisma.prediction.findMany({
      where: { storeId: ctx.storeId, active: true, predictionType: { in: predictionFilter as never[] } },
      orderBy: { rankScore: "desc" },
      take: 10,
    }),
    prisma.rootCause.findMany({
      where: { storeId: ctx.storeId, active: true, businessOutcome: { in: outcomeFilter as never[] } },
      orderBy: { rankScore: "desc" },
      take: 10,
    }),
    prisma.experiment.findMany({
      where: { storeId: ctx.storeId, experimentDomain: experimentDomain as never },
      orderBy: { rankScore: "desc" },
      take: 10,
    }),
    buildGraphNodes(ctx.storeId, 20),
    getPatternSeeds(ctx.storeId),
  ]);

  return {
    ...shell,
    workspace: {
      kind: "domain",
      domain,
      predictions: predictions.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        predictedOutcome: p.predictedOutcome,
        confidence: Number(p.confidence),
        expectedBusinessImpact: Number(p.expectedBusinessImpact),
        evidenceIds: jsonArray(p.evidenceIds),
        graphNodeIds: jsonArray(p.graphNodeIds),
      })),
      rootCauses: rootCauses.map((r) => ({
        id: r.id,
        primaryCause: r.primaryCause,
        businessOutcome: r.businessOutcome,
        severity: r.severity,
        confidence: Number(r.confidence),
        evidenceIds: jsonArray(r.evidenceIds),
        graphNodeIds: jsonArray(r.graphNodeIds),
        businessMemoryIds: jsonArray(r.businessMemoryIds),
      })),
      experiments: experiments.map((e) => ({
        id: e.id,
        title: e.title,
        proposedChange: e.proposedChange,
        status: e.status,
        confidence: Number(e.confidence),
        expectedRevenueImpact: Number(e.expectedRevenueImpact),
      })),
      graphNodes,
      patterns: patterns.slice(0, 5).map((p) => ({
        semanticLabel: p.semanticLabel,
        confidence: Number(p.confidence),
        patternType: p.patternType,
      })),
    },
  };
}

export async function getRootCausesWorkspaceData(ctx: StoreContext): Promise<IntelligenceWorkspaceLoaderData> {
  const shell = await loadWorkspaceShell(ctx);
  const [items, causes, timelineRaw, graphNodes] = await Promise.all([
    getRootCauseUiItems(ctx.storeId),
    getRootCauses(ctx.storeId),
    getBusinessTimeline(ctx.storeId),
    buildGraphNodes(ctx.storeId),
  ]);

  const timeline: TimelineEventView[] = timelineRaw.events.map((event) => ({
    id: event.eventId,
    title: event.label,
    category: event.signal,
    occurredAt: timelineRaw.generatedAt,
    description: event.role,
  }));

  return {
    ...shell,
    timeline: timeline.length > 0 ? timeline : shell.timeline,
    workspace: { kind: "root-causes", items, causes, timeline, graphNodes },
  };
}

export async function getPredictionsWorkspaceData(ctx: StoreContext): Promise<IntelligenceWorkspaceLoaderData> {
  const shell = await loadWorkspaceShell(ctx);
  const [items, predictions, stability] = await Promise.all([
    getPredictionUiItems(ctx.storeId),
    getPredictions(ctx.storeId),
    getBusinessStability(ctx.storeId),
  ]);
  return {
    ...shell,
    workspace: {
      kind: "predictions",
      items,
      predictions,
      stabilityScore: stability?.score ?? 0,
    },
  };
}

export async function getExperimentsWorkspaceData(ctx: StoreContext): Promise<IntelligenceWorkspaceLoaderData> {
  const shell = await loadWorkspaceShell(ctx);
  const [items, recommendations] = await Promise.all([
    getExperimentUiItems(ctx.storeId),
    getExperimentRecommendations(ctx.storeId),
  ]);
  return {
    ...shell,
    workspace: { kind: "experiments", items, recommendationCount: recommendations.length },
  };
}

export async function getMerchantIntelligenceWorkspaceData(
  ctx: StoreContext,
): Promise<IntelligenceWorkspaceLoaderData> {
  const shell = await loadWorkspaceShell(ctx);
  const [dashboard, profile, dna, journal, confidence] = await Promise.all([
    getMerchantIntelligenceDashboardForUi(ctx.storeId),
    getMerchantProfile(ctx.storeId),
    getLatestBusinessDna(ctx.storeId),
    getDecisionJournal(ctx.storeId, 15),
    getConfidenceEvolution(ctx.storeId),
  ]);
  return {
    ...shell,
    workspace: { kind: "merchant-intelligence", dashboard, profile, dna, journal, confidence },
  };
}

export async function getBusinessMemoryWorkspaceData(
  ctx: StoreContext,
): Promise<IntelligenceWorkspaceLoaderData> {
  const shell = await loadWorkspaceShell(ctx);
  const [memory, snapshots, patterns, confidence, dnaVersions] = await Promise.all([
    getHistoricalMemory(ctx.storeId),
    getHistoricalSnapshots(ctx.storeId),
    getPatternSeeds(ctx.storeId),
    getConfidenceSeeds(ctx.storeId),
    getBusinessDnaVersions(ctx.storeId),
  ]);
  return {
    ...shell,
    workspace: {
      kind: "business-memory",
      memoryUpdated: memory?.updatedAt?.toISOString() ?? null,
      snapshots,
      patterns,
      confidence,
      dnaVersions,
    },
  };
}

export async function getKnowledgeGraphWorkspaceData(
  ctx: StoreContext,
): Promise<IntelligenceWorkspaceLoaderData> {
  const shell = await loadWorkspaceShell(ctx);
  const api = createKnowledgeGraphApi();
  const [stats, nodes] = await Promise.all([
    api.getStatistics(ctx.storeId),
    buildGraphNodes(ctx.storeId, 50),
  ]);
  return {
    ...shell,
    workspace: {
      kind: "knowledge-graph",
      totalNodes: stats.totalNodes,
      totalEdges: stats.totalEdges,
      nodes,
    },
  };
}

export async function getProductsWorkspaceData(ctx: StoreContext): Promise<IntelligenceWorkspaceLoaderData> {
  const shell = await loadWorkspaceShell(ctx);
  const products = await prisma.product.findMany({
    where: { storeId: ctx.storeId, status: "active" },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
  return {
    ...shell,
    workspace: {
      kind: "products",
      products: products.map((p) => ({
        id: p.id,
        title: p.title,
        sku: p.sku,
        inventoryQuantity: p.inventoryQuantity,
        price: p.price ? String(p.price) : null,
      })),
    },
  };
}

export async function getProductDetailWorkspaceData(
  ctx: StoreContext,
  productId: string,
): Promise<IntelligenceWorkspaceLoaderData> {
  const product = await prisma.product.findFirst({
    where: { id: productId, storeId: ctx.storeId },
  });
  if (!product) {
    const shell = await loadWorkspaceShell(ctx);
    return { ...shell, workspace: null };
  }

  const shell = await loadWorkspaceShell(ctx);
  const api = createKnowledgeGraphApi();
  const [graph, predictions, experiments] = await Promise.all([
    api.getProductGraph(ctx.storeId, product.shopifyProductId).catch(() => null),
    prisma.prediction.findMany({
      where: { storeId: ctx.storeId, active: true },
      orderBy: { rankScore: "desc" },
      take: 5,
      select: { id: true, title: true },
    }),
    prisma.experiment.findMany({
      where: { storeId: ctx.storeId },
      orderBy: { rankScore: "desc" },
      take: 5,
      select: { id: true, title: true },
    }),
  ]);

  const graphNodes: RelationshipNodeView[] =
    graph && typeof graph === "object" && "nodes" in graph && Array.isArray((graph as { nodes: unknown[] }).nodes)
      ? (graph as { nodes: Array<{ id: string; nodeType: string; displayName: string; canonicalKey: string }> }).nodes.map(
          (node) => ({
            id: node.id,
            nodeType: node.nodeType,
            displayName: node.displayName,
            canonicalKey: node.canonicalKey,
          }),
        )
      : [];

  return {
    ...shell,
    workspace: {
      kind: "product-detail",
      product: {
        id: product.id,
        title: product.title,
        sku: product.sku,
        inventoryQuantity: product.inventoryQuantity,
        price: product.price ? String(product.price) : null,
        shopifyProductId: product.shopifyProductId,
      },
      graphNodes,
      predictions,
      experiments,
    },
  };
}

export async function getCollectionsWorkspaceData(ctx: StoreContext): Promise<IntelligenceWorkspaceLoaderData> {
  const shell = await loadWorkspaceShell(ctx);
  const collections = await prisma.knowledgeGraphNode.findMany({
    where: { storeId: ctx.storeId, nodeType: "Collection" },
    orderBy: { updatedAt: "desc" },
    take: 30,
  });
  return {
    ...shell,
    workspace: {
      kind: "collections",
      collections: collections.map((c) => ({
        id: c.id,
        displayName: c.displayName,
        canonicalKey: c.canonicalKey,
      })),
    },
  };
}

export async function getTimelineWorkspaceData(ctx: StoreContext): Promise<IntelligenceWorkspaceLoaderData> {
  const shell = await loadWorkspaceShell(ctx);
  const journal = await getDecisionJournal(ctx.storeId, 20);
  return {
    ...shell,
    workspace: { kind: "timeline", timeline: shell.timeline, journalCount: journal.length },
  };
}

export function createIntelligenceWorkspaceLoader(
  builder: (ctx: StoreContext) => Promise<IntelligenceWorkspaceLoaderData>,
) {
  return async ({ request }: LoaderFunctionArgs) => {
    const ctx = await resolveStoreContext(request);
    if (!ctx) {
      return { workspace: null, searchResults: [], timeline: [], currency: "USD" };
    }
    return builder(ctx);
  };
}

export function createFeatureGatedWorkspaceLoader(input: {
  feature: import("../billing/plan-registry").FeatureKey;
  builder: (ctx: StoreContext) => Promise<IntelligenceWorkspaceLoaderData>;
}) {
  return async ({ request }: LoaderFunctionArgs) => {
    const ctx = await resolveStoreContext(request);
    if (!ctx) {
      return {
        workspace: null,
        searchResults: [],
        timeline: [],
        currency: "USD",
        featureGate: null,
      };
    }

    const { getStoreFeatureAvailability } = await import("../billing/feature-gates.server");
    const { toFeatureGateViewModel, serializeFeatureGateViewModel } = await import(
      "../billing/feature-gate-view"
    );
    const availability = await getStoreFeatureAvailability(ctx.storeId, input.feature);
    const featureGate = serializeFeatureGateViewModel(toFeatureGateViewModel(availability));

    if (!availability.available) {
      return {
        workspace: null,
        searchResults: [],
        timeline: [],
        currency: ctx.currency,
        featureGate,
      };
    }

    const loaded = await input.builder(ctx);
    return { ...loaded, featureGate };
  };
}
