import type { FeatureGateViewModel } from "../billing/billing-types";
import { getExperimentUiItems } from "../experiments/api/experiment-api";
import {
  getExecutiveDecisions,
  getOperationsQueue,
} from "../executive/api/executive-api";
import {
  getPredictionUiItems,
  getPredictions,
} from "../prediction/api/prediction-api";
import {
  getRootCauseUiItems,
  getRootCauses,
} from "../root-cause/api/root-cause-api";
import {
  getConfidenceEvolution,
  getDecisionJournal,
  getMerchantProfile,
} from "../merchant-intelligence/api/merchant-intelligence-api";
import {
  getConfidenceSeeds,
  getBusinessDnaVersions,
  getHistoricalSnapshots,
  getLatestBusinessDna,
  getPatternSeeds,
} from "../learning/historical/api/historical-api";
import type {
  RelationshipNodeView,
  SearchResultView,
  TimelineEventView,
} from "../intelligence-ui/types";
import { getExecutiveDashboardForUi } from "./executive-ui.server";
import { getMerchantIntelligenceDashboardForUi } from "./merchant-intelligence-ui.server";

export type ExecutiveWorkspaceData = {
  kind: "executive";
  executive: Awaited<ReturnType<typeof getExecutiveDashboardForUi>>;
  decisions: Awaited<ReturnType<typeof getExecutiveDecisions>>;
  queue: Awaited<ReturnType<typeof getOperationsQueue>>;
  stabilityScore: number;
  merchant: Awaited<ReturnType<typeof getMerchantIntelligenceDashboardForUi>>;
  memoryUpdated: string | null;
};

export type DomainWorkspaceData = {
  kind: "domain";
  domain: "inventory" | "pricing" | "seo";
  predictions: Array<{
    id: string;
    title: string;
    description: string;
    predictedOutcome: string;
    confidence: number;
    expectedBusinessImpact: number;
    evidenceIds: string[];
    graphNodeIds: string[];
  }>;
  rootCauses: Array<{
    id: string;
    primaryCause: string;
    businessOutcome: string;
    severity: string;
    confidence: number;
    evidenceIds: string[];
    graphNodeIds: string[];
    businessMemoryIds: string[];
  }>;
  experiments: Array<{
    id: string;
    title: string;
    proposedChange: string;
    status: string;
    confidence: number;
    expectedRevenueImpact: number;
  }>;
  graphNodes: RelationshipNodeView[];
  patterns: Array<{ semanticLabel: string; confidence: number; patternType: string }>;
};

export type RootCausesWorkspaceData = {
  kind: "root-causes";
  items: Awaited<ReturnType<typeof getRootCauseUiItems>>;
  causes: Awaited<ReturnType<typeof getRootCauses>>;
  timeline: TimelineEventView[];
  graphNodes: RelationshipNodeView[];
};

export type PredictionsWorkspaceData = {
  kind: "predictions";
  items: Awaited<ReturnType<typeof getPredictionUiItems>>;
  predictions: Awaited<ReturnType<typeof getPredictions>>;
  stabilityScore: number;
};

export type ExperimentsWorkspaceData = {
  kind: "experiments";
  items: Awaited<ReturnType<typeof getExperimentUiItems>>;
  recommendationCount: number;
};

export type MerchantIntelligenceWorkspaceData = {
  kind: "merchant-intelligence";
  dashboard: Awaited<ReturnType<typeof getMerchantIntelligenceDashboardForUi>>;
  profile: Awaited<ReturnType<typeof getMerchantProfile>>;
  dna: Awaited<ReturnType<typeof getLatestBusinessDna>>;
  journal: Awaited<ReturnType<typeof getDecisionJournal>>;
  confidence: Awaited<ReturnType<typeof getConfidenceEvolution>>;
};

export type BusinessMemoryWorkspaceData = {
  kind: "business-memory";
  memoryUpdated: string | null;
  snapshots: Awaited<ReturnType<typeof getHistoricalSnapshots>>;
  patterns: Awaited<ReturnType<typeof getPatternSeeds>>;
  confidence: Awaited<ReturnType<typeof getConfidenceSeeds>>;
  dnaVersions: Awaited<ReturnType<typeof getBusinessDnaVersions>>;
};

export type KnowledgeGraphWorkspaceData = {
  kind: "knowledge-graph";
  totalNodes: number;
  totalEdges: number;
  nodes: RelationshipNodeView[];
};

export type ProductsWorkspaceData = {
  kind: "products";
  products: Array<{
    id: string;
    title: string;
    sku: string | null;
    inventoryQuantity: number | null;
    price: string | null;
  }>;
};

export type ProductDetailWorkspaceData = {
  kind: "product-detail";
  product: {
    id: string;
    title: string;
    sku: string | null;
    inventoryQuantity: number | null;
    price: string | null;
    shopifyProductId: string;
  };
  graphNodes: RelationshipNodeView[];
  predictions: Array<{ id: string; title: string }>;
  experiments: Array<{ id: string; title: string }>;
};

export type CollectionsWorkspaceData = {
  kind: "collections";
  collections: Array<{ id: string; displayName: string; canonicalKey: string }>;
};

export type TimelineWorkspaceData = {
  kind: "timeline";
  timeline: TimelineEventView[];
  journalCount: number;
};

export type IntelligenceWorkspacePayload =
  | ExecutiveWorkspaceData
  | DomainWorkspaceData
  | RootCausesWorkspaceData
  | PredictionsWorkspaceData
  | ExperimentsWorkspaceData
  | MerchantIntelligenceWorkspaceData
  | BusinessMemoryWorkspaceData
  | KnowledgeGraphWorkspaceData
  | ProductsWorkspaceData
  | ProductDetailWorkspaceData
  | CollectionsWorkspaceData
  | TimelineWorkspaceData;

/** Serializable loader payload for intelligence workspace routes. */
export type IntelligenceWorkspaceLoaderData = {
  workspace: IntelligenceWorkspacePayload | null;
  searchResults: SearchResultView[];
  timeline: TimelineEventView[];
  currency: string;
  featureGate?: FeatureGateViewModel | null;
};
