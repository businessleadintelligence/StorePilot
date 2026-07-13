import type { LoaderFunctionArgs } from "react-router";

import prisma from "../db.server";
import { resolveRequestStoreContext } from "../lib/request-auth.server";
import { isReactRouterDataRequest } from "../lib/react-router-request.server";
import {
  deferIntelligenceSection,
  getRequestLogContext,
  timeLoaderSection,
} from "../lib/route-loader-log.server";
import {
  getExecutiveDecisions,
  getOperationsQueue,
} from "../executive/api/executive-api";
import { getExperimentRecommendations, getExperimentUiItems } from "../experiments/api/experiment-api";
import {
  getBusinessTimeline,
  getRootCauseTimeline,
  getRootCauses,
  mapRootCauseUiItemsFromRows,
} from "../root-cause/api/root-cause-api";
import {
  getBusinessStability,
  getPredictions,
  mapPredictionUiItemsFromRows,
} from "../prediction/api/prediction-api";
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
import { getGraphStatisticsForLoader } from "../knowledge/graph/metrics/graph-metrics";
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
  const ctx = await resolveRequestStoreContext(request);
  if (!ctx) {
    return null;
  }

  return { storeId: ctx.storeId, currency: ctx.currency };
}

const EMPTY_WORKSPACE_LOADER: IntelligenceWorkspaceLoaderData = {
  workspace: null,
  searchResults: [],
  timeline: [],
  currency: "USD",
};

type WorkspaceCoreData = Pick<
  IntelligenceWorkspaceLoaderData,
  "workspace" | "currency" | "featureGate"
>;

function resolveProductPagination(request: Request) {
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") || 1) || 1);
  const pageSize = Math.min(
    50,
    Math.max(20, Number(url.searchParams.get("pageSize") || 25) || 25),
  );
  return { page, pageSize, skip: (page - 1) * pageSize };
}

function buildLoaderLogContext(
  request: Request,
  ctx: StoreContext,
): {
  shop: string | null;
  storeId: string;
  route: string;
  requestId: string | null;
} {
  const { route, requestId } = getRequestLogContext(request);
  return { route, requestId, storeId: ctx.storeId, shop: null };
}

function attachDeferredWorkspaceShell(
  ctx: StoreContext,
  core: WorkspaceCoreData,
  logContext: ReturnType<typeof buildLoaderLogContext>,
): IntelligenceWorkspaceLoaderData {
  return {
    ...core,
    searchResults: deferIntelligenceSection("globalSearch", logContext, () =>
      buildGlobalSearch(ctx.storeId),
    ) as unknown as SearchResultView[],
    timeline: deferIntelligenceSection("unifiedTimeline", logContext, () =>
      buildUnifiedTimeline(ctx.storeId),
    ) as unknown as TimelineEventView[],
  };
}

function attachStreamingWorkspace(
  ctx: StoreContext,
  logContext: ReturnType<typeof buildLoaderLogContext>,
  builder: (ctx: StoreContext, request: Request) => Promise<WorkspaceCoreData>,
  request: Request,
): IntelligenceWorkspaceLoaderData {
  const workspace = deferIntelligenceSection("workspaceCore", logContext, async () => {
    const core = await timeLoaderSection(
      "workspaceCore",
      { ...logContext, category: "database" },
      () => builder(ctx, request),
    );
    return core.workspace;
  });

  return {
    currency: ctx.currency,
    workspace: workspace as IntelligenceWorkspaceLoaderData["workspace"],
    searchResults: deferIntelligenceSection("globalSearch", logContext, () =>
      buildGlobalSearch(ctx.storeId),
    ) as unknown as SearchResultView[],
    timeline: deferIntelligenceSection("unifiedTimeline", logContext, () =>
      buildUnifiedTimeline(ctx.storeId),
    ) as unknown as TimelineEventView[],
  };
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

export async function getExecutiveWorkspaceData(
  ctx: StoreContext,
  _request: Request,
): Promise<WorkspaceCoreData> {
  // Critical path: decisions + executive UI + queue + stability (first paint cards).
  // Merchant intelligence + historical memory are secondary (Phase 4) but still loaded
  // in parallel so we do not add a sequential waterfalls after decisions.
  const decisionsPromise = getExecutiveDecisions(ctx.storeId);
  const [decisions, queue, stability, merchant, memory, executive] = await Promise.all([
    decisionsPromise,
    getOperationsQueue(ctx.storeId),
    getBusinessStability(ctx.storeId),
    getMerchantIntelligenceDashboardForUi(ctx.storeId),
    getHistoricalMemory(ctx.storeId),
    decisionsPromise.then((decisions) =>
      getExecutiveDashboardForUi(ctx.storeId, ctx.currency, {
        prefetchedDecisions: decisions,
      }),
    ),
  ]);

  return {
    currency: ctx.currency,
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
  _request: Request,
): Promise<WorkspaceCoreData> {
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
      take: 20,
    }),
    prisma.rootCause.findMany({
      where: { storeId: ctx.storeId, active: true, businessOutcome: { in: outcomeFilter as never[] } },
      orderBy: { rankScore: "desc" },
      take: 20,
    }),
    prisma.experiment.findMany({
      where: { storeId: ctx.storeId, experimentDomain: experimentDomain as never },
      orderBy: { rankScore: "desc" },
      take: 20,
    }),
    buildGraphNodes(ctx.storeId, 20),
    getPatternSeeds(ctx.storeId),
  ]);

  return {
    currency: ctx.currency,
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

export async function getRootCausesWorkspaceData(
  ctx: StoreContext,
  _request: Request,
): Promise<WorkspaceCoreData> {
  const [causes, timelineRaw, graphNodes] = await Promise.all([
    getRootCauses(ctx.storeId),
    getBusinessTimeline(ctx.storeId),
    buildGraphNodes(ctx.storeId, 30),
  ]);
  const items = mapRootCauseUiItemsFromRows(causes);

  const timeline: TimelineEventView[] = timelineRaw.events.map((event) => ({
    id: event.eventId,
    title: event.label,
    category: event.signal,
    occurredAt: timelineRaw.generatedAt,
    description: event.role,
  }));

  return {
    currency: ctx.currency,
    workspace: { kind: "root-causes", items, causes, timeline, graphNodes },
  };
}

export async function getPredictionsWorkspaceData(
  ctx: StoreContext,
  _request: Request,
): Promise<WorkspaceCoreData> {
  const [predictions, stability] = await Promise.all([
    getPredictions(ctx.storeId),
    getBusinessStability(ctx.storeId),
  ]);
  const items = mapPredictionUiItemsFromRows(predictions);
  return {
    currency: ctx.currency,
    workspace: {
      kind: "predictions",
      items,
      predictions,
      stabilityScore: stability?.score ?? 0,
    },
  };
}

export async function getExperimentsWorkspaceData(
  ctx: StoreContext,
  _request: Request,
): Promise<WorkspaceCoreData> {
  const [items, recommendations] = await Promise.all([
    getExperimentUiItems(ctx.storeId),
    getExperimentRecommendations(ctx.storeId),
  ]);
  return {
    currency: ctx.currency,
    workspace: { kind: "experiments", items, recommendationCount: recommendations.length },
  };
}

export async function getMerchantIntelligenceWorkspaceData(
  ctx: StoreContext,
  _request: Request,
): Promise<WorkspaceCoreData> {
  const [dashboard, profile, dna, journal, confidence] = await Promise.all([
    getMerchantIntelligenceDashboardForUi(ctx.storeId),
    getMerchantProfile(ctx.storeId),
    getLatestBusinessDna(ctx.storeId),
    getDecisionJournal(ctx.storeId, 15),
    getConfidenceEvolution(ctx.storeId),
  ]);
  return {
    currency: ctx.currency,
    workspace: { kind: "merchant-intelligence", dashboard, profile, dna, journal, confidence },
  };
}

export async function getBusinessMemoryWorkspaceData(
  ctx: StoreContext,
  _request: Request,
): Promise<WorkspaceCoreData> {
  const [memory, snapshots, patterns, confidence, dnaVersions] = await Promise.all([
    getHistoricalMemory(ctx.storeId),
    getHistoricalSnapshots(ctx.storeId),
    getPatternSeeds(ctx.storeId),
    getConfidenceSeeds(ctx.storeId),
    getBusinessDnaVersions(ctx.storeId),
  ]);
  return {
    currency: ctx.currency,
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
  _request: Request,
): Promise<WorkspaceCoreData> {
  const [stats, nodes] = await Promise.all([
    getGraphStatisticsForLoader(ctx.storeId),
    buildGraphNodes(ctx.storeId, 50),
  ]);
  return {
    currency: ctx.currency,
    workspace: {
      kind: "knowledge-graph",
      totalNodes: stats.totalNodes,
      totalEdges: stats.totalEdges,
      nodes,
    },
  };
}

export async function getProductsWorkspaceData(
  ctx: StoreContext,
  request: Request,
): Promise<WorkspaceCoreData> {
  const { page, pageSize, skip } = resolveProductPagination(request);
  const where = { storeId: ctx.storeId, status: "active" as const };
  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: pageSize,
      skip,
      select: {
        id: true,
        title: true,
        sku: true,
        inventoryQuantity: true,
        price: true,
      },
    }),
    prisma.product.count({ where }),
  ]);
  return {
    currency: ctx.currency,
    workspace: {
      kind: "products",
      page,
      pageSize,
      total,
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
  _request: Request,
): Promise<WorkspaceCoreData> {
  const product = await prisma.product.findFirst({
    where: { id: productId, storeId: ctx.storeId },
  });
  if (!product) {
    return {
      currency: ctx.currency,
      workspace: null,
    };
  }

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
    currency: ctx.currency,
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

export async function getCollectionsWorkspaceData(
  ctx: StoreContext,
  _request: Request,
): Promise<WorkspaceCoreData> {
  const collections = await prisma.knowledgeGraphNode.findMany({
    where: { storeId: ctx.storeId, nodeType: "Collection" },
    orderBy: { updatedAt: "desc" },
    take: 30,
  });
  return {
    currency: ctx.currency,
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

export async function getTimelineWorkspaceData(
  ctx: StoreContext,
  _request: Request,
): Promise<WorkspaceCoreData> {
  const journal = await getDecisionJournal(ctx.storeId, 20);
  return {
    currency: ctx.currency,
    workspace: { kind: "timeline", timeline: [], journalCount: journal.length },
  };
}

async function runTimedWorkspaceLoader(
  request: Request,
  builder: (ctx: StoreContext, request: Request) => Promise<WorkspaceCoreData>,
): Promise<IntelligenceWorkspaceLoaderData | typeof EMPTY_WORKSPACE_LOADER> {
  const { route, requestId } = getRequestLogContext(request);
  const ctx = await timeLoaderSection(
    "authenticateAndResolveStore",
    { route, requestId, category: "auth" },
    () => resolveStoreContext(request),
  );
  if (!ctx) {
    return EMPTY_WORKSPACE_LOADER;
  }

  const logContext = buildLoaderLogContext(request, ctx);

  // Always stream workspace + shell. Do not empty-shell + client-revalidate:
  // that pattern caused ~7–10s FCP/LCP on embedded Executive (field CWV).
  // Auth still blocks TTFB; DB work streams into Suspense/Await boundaries.
  if (isReactRouterDataRequest(request)) {
    const core = await timeLoaderSection(
      "workspaceCore",
      { ...logContext, category: "database" },
      () => builder(ctx, request),
    );
    return attachDeferredWorkspaceShell(ctx, core, logContext);
  }

  return attachStreamingWorkspace(ctx, logContext, builder, request);
}

export function createIntelligenceWorkspaceLoader(
  builder: (ctx: StoreContext, request: Request) => Promise<WorkspaceCoreData>,
) {
  return async ({ request }: LoaderFunctionArgs) => runTimedWorkspaceLoader(request, builder);
}

export function createFeatureGatedWorkspaceLoader(input: {
  feature: import("../billing/plan-registry").FeatureKey;
  builder: (ctx: StoreContext, request: Request) => Promise<WorkspaceCoreData>;
}) {
  return async ({ request }: LoaderFunctionArgs) => {
    const { route, requestId } = getRequestLogContext(request);
    const ctx = await timeLoaderSection(
      "authenticateAndResolveStore",
      { route, requestId, category: "auth" },
      () => resolveStoreContext(request),
    );
    if (!ctx) {
      return {
        ...EMPTY_WORKSPACE_LOADER,
        featureGate: null,
      };
    }

    const logContext = buildLoaderLogContext(request, ctx);

    const { getStoreFeatureAvailability } = await import("../billing/feature-gates.server");
    const { toFeatureGateViewModel, serializeFeatureGateViewModel } = await import(
      "../billing/feature-gate-view"
    );

    const availability = await timeLoaderSection("featureGate", { ...logContext, category: "billing" }, () =>
      getStoreFeatureAvailability(ctx.storeId, input.feature),
    );
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

    if (isReactRouterDataRequest(request)) {
      const core = await timeLoaderSection("workspaceCore", { ...logContext, category: "database" }, () =>
        input.builder(ctx, request),
      );
      return { ...attachDeferredWorkspaceShell(ctx, core, logContext), featureGate };
    }

    return { ...attachStreamingWorkspace(ctx, logContext, input.builder, request), featureGate };
  };
}
