CREATE TYPE "EvidenceEntityType" AS ENUM ('Product', 'Variant', 'Collection', 'Order', 'Refund', 'Location', 'Vendor', 'Inventory');
CREATE TYPE "KnowledgeIntelligenceDomain" AS ENUM ('product_intelligence', 'inventory_intelligence', 'pricing_intelligence', 'operations_intelligence', 'executive_coo');
CREATE TYPE "KnowledgeSyncMode" AS ENUM ('initial_import', 'incremental', 'manual_rebuild', 'evidence_refresh', 'fact_refresh', 'webhook_resume');
CREATE TYPE "EvidenceChangeType" AS ENUM ('created', 'updated', 'expired');

ALTER TYPE "JobType" ADD VALUE IF NOT EXISTS 'knowledge_ingest';
ALTER TYPE "JobType" ADD VALUE IF NOT EXISTS 'knowledge_fact_refresh';

CREATE TABLE "evidence_sources" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "sourceType" VARCHAR(50) NOT NULL,
    "sourceRef" VARCHAR(100) NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "lastSyncAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "evidence_sources_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "evidence" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "entity" "EvidenceEntityType" NOT NULL,
    "entityId" VARCHAR(100) NOT NULL,
    "factType" VARCHAR(100) NOT NULL,
    "value" JSONB,
    "sourceId" UUID,
    "confidence" DECIMAL(5,4) NOT NULL DEFAULT 1,
    "freshnessMinutes" INTEGER,
    "completeness" DECIMAL(5,4),
    "reliability" DECIMAL(5,4),
    "observationCount" INTEGER NOT NULL DEFAULT 1,
    "sourcePriority" INTEGER NOT NULL DEFAULT 100,
    "observedAt" TIMESTAMPTZ NOT NULL,
    "lastUpdated" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "evidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "evidence_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "evidenceId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "changeType" "EvidenceChangeType" NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "evidence_history_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "evidence_relationships" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "fromEvidenceId" UUID NOT NULL,
    "toEvidenceId" UUID NOT NULL,
    "relationshipType" VARCHAR(100) NOT NULL,
    CONSTRAINT "evidence_relationships_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "evidence_observations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "evidenceId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "observedAt" TIMESTAMPTZ NOT NULL,
    "value" JSONB,
    "sourceId" UUID,
    "dedupeKey" VARCHAR(255) NOT NULL,
    CONSTRAINT "evidence_observations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "knowledge_sync_checkpoints" (
    "storeId" UUID NOT NULL,
    "syncMode" "KnowledgeSyncMode" NOT NULL DEFAULT 'initial_import',
    "status" VARCHAR(50) NOT NULL DEFAULT 'idle',
    "productCursor" TEXT,
    "orderCursor" TEXT,
    "inventoryCursor" TEXT,
    "collectionCursor" TEXT,
    "lastSyncAt" TIMESTAMPTZ,
    "checkpointJson" JSONB NOT NULL DEFAULT '{}',
    "productsProcessed" INTEGER NOT NULL DEFAULT 0,
    "ordersProcessed" INTEGER NOT NULL DEFAULT 0,
    "evidenceCreated" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "knowledge_sync_checkpoints_pkey" PRIMARY KEY ("storeId")
);

CREATE TABLE "knowledge_readiness" (
    "storeId" UUID NOT NULL,
    "productIntelligencePercent" INTEGER NOT NULL DEFAULT 0,
    "inventoryIntelligencePercent" INTEGER NOT NULL DEFAULT 0,
    "pricingIntelligencePercent" INTEGER NOT NULL DEFAULT 0,
    "operationsIntelligencePercent" INTEGER NOT NULL DEFAULT 0,
    "executiveCooPercent" INTEGER NOT NULL DEFAULT 0,
    "overallPercent" INTEGER NOT NULL DEFAULT 0,
    "lastComputedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "knowledge_readiness_pkey" PRIMARY KEY ("storeId")
);

CREATE UNIQUE INDEX "evidence_source_store_ref_unique" ON "evidence_sources"("storeId", "sourceType", "sourceRef");
CREATE UNIQUE INDEX "evidence_store_entity_fact_unique" ON "evidence"("storeId", "entity", "entityId", "factType");
CREATE INDEX "evidence_store_fact_type_idx" ON "evidence"("storeId", "factType");
CREATE INDEX "evidence_store_entity_idx" ON "evidence"("storeId", "entity", "entityId");
CREATE INDEX "evidence_store_active_updated_idx" ON "evidence"("storeId", "active", "lastUpdated");
CREATE INDEX "evidence_history_store_changed_idx" ON "evidence_history"("storeId", "changedAt");
CREATE INDEX "evidence_history_evidence_changed_idx" ON "evidence_history"("evidenceId", "changedAt");
CREATE UNIQUE INDEX "evidence_relationship_unique" ON "evidence_relationships"("storeId", "fromEvidenceId", "toEvidenceId", "relationshipType");
CREATE UNIQUE INDEX "evidence_observation_dedupe_unique" ON "evidence_observations"("storeId", "dedupeKey");
CREATE INDEX "evidence_observation_evidence_observed_idx" ON "evidence_observations"("evidenceId", "observedAt");

ALTER TABLE "evidence_sources" ADD CONSTRAINT "evidence_sources_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "evidence_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "evidence_history" ADD CONSTRAINT "evidence_history_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "evidence_history" ADD CONSTRAINT "evidence_history_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "evidence_relationships" ADD CONSTRAINT "evidence_relationships_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "evidence_relationships" ADD CONSTRAINT "evidence_relationships_fromEvidenceId_fkey" FOREIGN KEY ("fromEvidenceId") REFERENCES "evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "evidence_relationships" ADD CONSTRAINT "evidence_relationships_toEvidenceId_fkey" FOREIGN KEY ("toEvidenceId") REFERENCES "evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "evidence_observations" ADD CONSTRAINT "evidence_observations_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "evidence_observations" ADD CONSTRAINT "evidence_observations_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "knowledge_sync_checkpoints" ADD CONSTRAINT "knowledge_sync_checkpoints_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_readiness" ADD CONSTRAINT "knowledge_readiness_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
