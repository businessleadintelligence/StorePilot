-- Knowledge Graph Platform (PostgreSQL-native graph on Prisma)

ALTER TYPE "JobType" ADD VALUE IF NOT EXISTS 'knowledge_graph_build';
ALTER TYPE "JobType" ADD VALUE IF NOT EXISTS 'knowledge_graph_incremental';

CREATE TYPE "KnowledgeGraphNodeType" AS ENUM (
  'Store', 'Product', 'Variant', 'Collection', 'InventoryItem', 'Vendor', 'Location',
  'Order', 'OrderItem', 'Price', 'Refund', 'SeoRecord', 'Media', 'Experiment',
  'Evidence', 'Recommendation', 'OperationalIssue', 'TrafficSource', 'SearchQuery',
  'MarketingChannel', 'BusinessDNA', 'Decision', 'Outcome'
);

CREATE TYPE "KnowledgeGraphEdgeType" AS ENUM (
  'BELONGS_TO', 'CONTAINS', 'USES', 'CREATES', 'AFFECTS', 'DEPENDS_ON', 'CAUSES',
  'SUPPORTS', 'GENERATES', 'OBSERVED_BY', 'MEASURED_BY', 'LEARNS_FROM', 'PREDICTS',
  'RESULTED_IN', 'CONNECTED_TO', 'RELATED_TO'
);

CREATE TYPE "KnowledgeGraphNodeStatus" AS ENUM ('active', 'archived', 'expired', 'pending');

CREATE TABLE "knowledge_graph_nodes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "nodeType" "KnowledgeGraphNodeType" NOT NULL,
    "canonicalKey" VARCHAR(150) NOT NULL,
    "displayName" VARCHAR(500) NOT NULL,
    "status" "KnowledgeGraphNodeStatus" NOT NULL DEFAULT 'active',
    "version" INTEGER NOT NULL DEFAULT 1,
    "confidence" DECIMAL(5,4) NOT NULL DEFAULT 1,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "evidenceId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "knowledge_graph_nodes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "knowledge_graph_edges" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "fromNodeId" UUID NOT NULL,
    "toNodeId" UUID NOT NULL,
    "relationship" "KnowledgeGraphEdgeType" NOT NULL,
    "confidence" DECIMAL(5,4) NOT NULL DEFAULT 1,
    "source" VARCHAR(100) NOT NULL,
    "evidenceId" UUID,
    "evidenceVersion" INTEGER,
    "evidenceSource" VARCHAR(100),
    "observationCount" INTEGER NOT NULL DEFAULT 1,
    "freshnessMinutes" INTEGER,
    "strength" DECIMAL(5,4),
    "weight" DECIMAL(8,4),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ,
    CONSTRAINT "knowledge_graph_edges_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "knowledge_graph_relationships" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "fromNodeId" UUID NOT NULL,
    "toNodeId" UUID NOT NULL,
    "relationship" "KnowledgeGraphEdgeType" NOT NULL,
    "semanticLabel" VARCHAR(150) NOT NULL,
    "evidenceId" UUID,
    "evidenceVersion" INTEGER,
    "evidenceSource" VARCHAR(100),
    "confidence" DECIMAL(5,4) NOT NULL DEFAULT 1,
    "observationCount" INTEGER NOT NULL DEFAULT 1,
    "freshnessMinutes" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "knowledge_graph_relationships_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "knowledge_graph_versions" (
    "storeId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "label" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "nodeCount" INTEGER NOT NULL DEFAULT 0,
    "edgeCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "knowledge_graph_versions_pkey" PRIMARY KEY ("storeId", "versionNumber")
);

CREATE TABLE "knowledge_graph_snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "snapshotHash" VARCHAR(64) NOT NULL,
    "nodeSnapshot" JSONB NOT NULL,
    "edgeSnapshot" JSONB NOT NULL,
    "metricsSnapshot" JSONB NOT NULL DEFAULT '{}',
    "immutable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "knowledge_graph_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "knowledge_graph_metadata" (
    "storeId" UUID NOT NULL,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "lastBuiltAt" TIMESTAMPTZ,
    "builderStatus" VARCHAR(50) NOT NULL DEFAULT 'idle',
    "builderCheckpoint" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "knowledge_graph_metadata_pkey" PRIMARY KEY ("storeId")
);

CREATE TABLE "knowledge_graph_integrity" (
    "storeId" UUID NOT NULL,
    "integrityScore" DECIMAL(5,4) NOT NULL DEFAULT 1,
    "issueCount" INTEGER NOT NULL DEFAULT 0,
    "issues" JSONB NOT NULL DEFAULT '[]',
    "lastCheckedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastRepairedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "knowledge_graph_integrity_pkey" PRIMARY KEY ("storeId")
);

CREATE TABLE "knowledge_graph_statistics" (
    "storeId" UUID NOT NULL,
    "totalNodes" INTEGER NOT NULL DEFAULT 0,
    "totalEdges" INTEGER NOT NULL DEFAULT 0,
    "averageDegree" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "connectedComponents" INTEGER NOT NULL DEFAULT 0,
    "disconnectedNodes" INTEGER NOT NULL DEFAULT 0,
    "graphDensity" DECIMAL(8,6) NOT NULL DEFAULT 0,
    "evidenceCoverage" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "businessCoverage" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "relationshipCoverage" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "lastComputedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "knowledge_graph_statistics_pkey" PRIMARY KEY ("storeId")
);

CREATE TABLE "knowledge_graph_search_index" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "nodeId" UUID,
    "edgeId" UUID,
    "searchText" VARCHAR(500) NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "knowledge_graph_search_index_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "knowledge_graph_build_checkpoints" (
    "storeId" UUID NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'idle',
    "evidenceCursor" UUID,
    "evidenceProcessed" INTEGER NOT NULL DEFAULT 0,
    "nodesCreated" INTEGER NOT NULL DEFAULT 0,
    "edgesCreated" INTEGER NOT NULL DEFAULT 0,
    "scopeEntityType" VARCHAR(50),
    "scopeEntityId" VARCHAR(100),
    "checkpointJson" JSONB NOT NULL DEFAULT '{}',
    "lastBuiltAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "knowledge_graph_build_checkpoints_pkey" PRIMARY KEY ("storeId")
);

CREATE UNIQUE INDEX "knowledge_graph_node_unique" ON "knowledge_graph_nodes"("storeId", "nodeType", "canonicalKey");
CREATE INDEX "knowledge_graph_node_store_type_idx" ON "knowledge_graph_nodes"("storeId", "nodeType");
CREATE INDEX "knowledge_graph_node_store_status_idx" ON "knowledge_graph_nodes"("storeId", "status");

CREATE UNIQUE INDEX "knowledge_graph_edge_unique" ON "knowledge_graph_edges"("storeId", "fromNodeId", "toNodeId", "relationship");
CREATE INDEX "knowledge_graph_edge_store_rel_idx" ON "knowledge_graph_edges"("storeId", "relationship");
CREATE INDEX "knowledge_graph_edge_from_idx" ON "knowledge_graph_edges"("storeId", "fromNodeId");
CREATE INDEX "knowledge_graph_edge_to_idx" ON "knowledge_graph_edges"("storeId", "toNodeId");
CREATE INDEX "knowledge_graph_edge_evidence_idx" ON "knowledge_graph_edges"("storeId", "evidenceId");

CREATE UNIQUE INDEX "knowledge_graph_relationship_unique" ON "knowledge_graph_relationships"("storeId", "fromNodeId", "toNodeId", "relationship", "semanticLabel");
CREATE INDEX "knowledge_graph_relationship_label_idx" ON "knowledge_graph_relationships"("storeId", "semanticLabel");

CREATE INDEX "knowledge_graph_snapshot_store_version_idx" ON "knowledge_graph_snapshots"("storeId", "versionNumber");
CREATE INDEX "knowledge_graph_snapshot_store_created_idx" ON "knowledge_graph_snapshots"("storeId", "createdAt");

CREATE INDEX "knowledge_graph_search_text_idx" ON "knowledge_graph_search_index"("storeId", "searchText");
CREATE INDEX "knowledge_graph_search_node_idx" ON "knowledge_graph_search_index"("storeId", "nodeId");

ALTER TABLE "knowledge_graph_nodes" ADD CONSTRAINT "knowledge_graph_nodes_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "knowledge_graph_nodes" ADD CONSTRAINT "knowledge_graph_nodes_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "evidence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "knowledge_graph_edges" ADD CONSTRAINT "knowledge_graph_edges_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "knowledge_graph_edges" ADD CONSTRAINT "knowledge_graph_edges_fromNodeId_fkey" FOREIGN KEY ("fromNodeId") REFERENCES "knowledge_graph_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_graph_edges" ADD CONSTRAINT "knowledge_graph_edges_toNodeId_fkey" FOREIGN KEY ("toNodeId") REFERENCES "knowledge_graph_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_graph_edges" ADD CONSTRAINT "knowledge_graph_edges_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "evidence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "knowledge_graph_relationships" ADD CONSTRAINT "knowledge_graph_relationships_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "knowledge_graph_relationships" ADD CONSTRAINT "knowledge_graph_relationships_fromNodeId_fkey" FOREIGN KEY ("fromNodeId") REFERENCES "knowledge_graph_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_graph_relationships" ADD CONSTRAINT "knowledge_graph_relationships_toNodeId_fkey" FOREIGN KEY ("toNodeId") REFERENCES "knowledge_graph_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_graph_relationships" ADD CONSTRAINT "knowledge_graph_relationships_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "evidence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "knowledge_graph_versions" ADD CONSTRAINT "knowledge_graph_versions_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_graph_snapshots" ADD CONSTRAINT "knowledge_graph_snapshots_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_graph_metadata" ADD CONSTRAINT "knowledge_graph_metadata_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_graph_integrity" ADD CONSTRAINT "knowledge_graph_integrity_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_graph_statistics" ADD CONSTRAINT "knowledge_graph_statistics_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_graph_search_index" ADD CONSTRAINT "knowledge_graph_search_index_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "knowledge_graph_search_index" ADD CONSTRAINT "knowledge_graph_search_index_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "knowledge_graph_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_graph_build_checkpoints" ADD CONSTRAINT "knowledge_graph_build_checkpoints_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
