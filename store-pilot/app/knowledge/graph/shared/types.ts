import type {
  KnowledgeGraphEdgeType,
  KnowledgeGraphNodeStatus,
  KnowledgeGraphNodeType,
} from "@prisma/client";

export type GraphNodeRecord = {
  id: string;
  storeId: string;
  nodeType: KnowledgeGraphNodeType;
  canonicalKey: string;
  displayName: string;
  status: KnowledgeGraphNodeStatus;
  version: number;
  confidence: number;
  metadata: Record<string, unknown>;
  evidenceId: string | null;
};

export type GraphEdgeRecord = {
  id: string;
  storeId: string;
  fromNodeId: string;
  toNodeId: string;
  relationship: KnowledgeGraphEdgeType;
  confidence: number;
  source: string;
  evidenceId: string | null;
  evidenceVersion: number | null;
  evidenceSource: string | null;
  observationCount: number;
  freshnessMinutes: number | null;
  strength: number | null;
  weight: number | null;
  active: boolean;
};

export type GraphBuildScope = {
  entityType?: string;
  entityId?: string;
};

export type GraphBuildInput = {
  storeId: string;
  storeName?: string;
  batchSize?: number;
  scope?: GraphBuildScope;
  resumeFromCheckpoint?: boolean;
  incremental?: boolean;
};

export type GraphBuildResult = {
  success: boolean;
  hasMoreWork: boolean;
  nodesCreated: number;
  nodesUpdated: number;
  edgesCreated: number;
  edgesUpdated: number;
  evidenceProcessed: number;
  snapshotVersion?: number;
  integrityScore?: number;
};

export type GraphTraversalNode = GraphNodeRecord & {
  depth: number;
};

export type GraphPath = {
  nodes: GraphNodeRecord[];
  edges: GraphEdgeRecord[];
  length: number;
};

export type GraphNeighborhood = {
  center: GraphNodeRecord;
  nodes: GraphNodeRecord[];
  edges: GraphEdgeRecord[];
};

export type GraphIntegrityIssue = {
  code: string;
  message: string;
  nodeId?: string;
  edgeId?: string;
  severity: "low" | "medium" | "high";
};

export type GraphStatisticsSnapshot = {
  totalNodes: number;
  totalEdges: number;
  averageDegree: number;
  connectedComponents: number;
  disconnectedNodes: number;
  graphDensity: number;
  evidenceCoverage: number;
  businessCoverage: number;
  relationshipCoverage: number;
};

export type BusinessDnaProfile = {
  storeType: string;
  revenueStrategy: string;
  pricingStrategy: string;
  inventoryStyle: string;
  seoMaturityPercent: number;
  operationalComplexity: string;
  growthStage: string;
  aiConfidencePercent: number;
};

export type GraphSnapshotDiff = {
  nodesAdded: number;
  nodesRemoved: number;
  edgesAdded: number;
  edgesRemoved: number;
  fromVersion: number;
  toVersion: number;
};

export const ENTITY_TO_NODE_TYPE: Record<string, KnowledgeGraphNodeType> = {
  Product: "Product",
  Variant: "Variant",
  Collection: "Collection",
  Order: "Order",
  Refund: "Refund",
  Location: "Location",
  Vendor: "Vendor",
  Inventory: "InventoryItem",
};

export const FACT_AFFECTS_MAP: Record<string, KnowledgeGraphEdgeType> = {
  InventoryLow: "AFFECTS",
  InventoryCritical: "AFFECTS",
  HighInventory: "AFFECTS",
  OutOfStock: "AFFECTS",
  MissingSEO: "AFFECTS",
  MissingMetaDescription: "AFFECTS",
  PriceChanged: "AFFECTS",
  MarginRiskCandidate: "AFFECTS",
  NeverSold: "AFFECTS",
  RefundRiskSeed: "AFFECTS",
};

export const SEO_FACT_TYPES = new Set(["MissingSEO", "MissingMetaDescription", "MissingAltText"]);
export const INVENTORY_FACT_TYPES = new Set([
  "InventoryLow",
  "InventoryCritical",
  "HighInventory",
  "OutOfStock",
]);
export const PRICE_FACT_TYPES = new Set([
  "PriceChanged",
  "MarginRiskCandidate",
  "PriceAboveCategoryAverage",
]);
