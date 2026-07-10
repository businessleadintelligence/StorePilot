-- CreateEnum
CREATE TYPE "BusinessOutcomeType" AS ENUM ('revenue_decrease', 'revenue_increase', 'conversion_decrease', 'conversion_increase', 'inventory_shortage', 'refund_spike', 'traffic_loss', 'organic_ranking_loss', 'checkout_abandonment', 'cart_abandonment', 'low_inventory_turnover', 'pricing_anomaly', 'seo_degradation', 'collection_underperformance', 'slow_moving_products', 'bundle_failure', 'store_speed_degradation', 'operational_bottleneck', 'automation_failure');

-- CreateEnum
CREATE TYPE "CausalRelationType" AS ENUM ('positive', 'negative', 'inverse', 'temporal', 'cross_domain');

-- CreateEnum
CREATE TYPE "RootCauseSeverity" AS ENUM ('low', 'medium', 'high', 'critical');

-- AlterEnum
ALTER TYPE "JobType" ADD VALUE 'root_cause_generate';

-- CreateTable root_causes, causal_chains, causal_timelines, signal_correlations,
-- cause_confidences, impact_assessments, causal_graph_edges, root_cause_history
-- (full SQL mirrors prisma models - generated below)

CREATE TABLE "root_causes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "causeKey" VARCHAR(120) NOT NULL,
    "businessOutcome" "BusinessOutcomeType" NOT NULL,
    "primaryCause" VARCHAR(300) NOT NULL,
    "secondaryCauses" JSONB NOT NULL DEFAULT '[]',
    "contributingFactors" JSONB NOT NULL DEFAULT '[]',
    "confidence" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "evidenceIds" JSONB NOT NULL DEFAULT '[]',
    "graphNodeIds" JSONB NOT NULL DEFAULT '[]',
    "businessMemoryIds" JSONB NOT NULL DEFAULT '[]',
    "quickWinIds" JSONB NOT NULL DEFAULT '[]',
    "merchantBaselineIds" JSONB NOT NULL DEFAULT '[]',
    "causalChain" JSONB NOT NULL DEFAULT '[]',
    "timeline" JSONB NOT NULL DEFAULT '[]',
    "historicalSupport" JSONB NOT NULL DEFAULT '{}',
    "impactEstimate" JSONB NOT NULL DEFAULT '{}',
    "severity" "RootCauseSeverity" NOT NULL DEFAULT 'medium',
    "urgency" INTEGER NOT NULL DEFAULT 0,
    "rankScore" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "generatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "root_causes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "causal_chains" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "rootCauseId" UUID NOT NULL,
    "chainKey" VARCHAR(120) NOT NULL,
    "chainJson" JSONB NOT NULL,
    "evidenceIds" JSONB NOT NULL DEFAULT '[]',
    "confidence" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "causal_chains_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "causal_timelines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "rootCauseId" UUID NOT NULL,
    "timelineKey" VARCHAR(120) NOT NULL,
    "eventsJson" JSONB NOT NULL,
    "confidence" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "causal_timelines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "signal_correlations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "correlationKey" VARCHAR(120) NOT NULL,
    "signalA" VARCHAR(100) NOT NULL,
    "signalB" VARCHAR(100) NOT NULL,
    "relationType" "CausalRelationType" NOT NULL,
    "strength" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "evidenceIds" JSONB NOT NULL DEFAULT '[]',
    "correlationJson" JSONB NOT NULL DEFAULT '{}',
    "computedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "signal_correlations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cause_confidences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "rootCauseId" UUID NOT NULL,
    "confidenceScore" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "evidenceCount" INTEGER NOT NULL DEFAULT 0,
    "graphSupport" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "historicalSupport" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "freshness" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "crossSourceAgreement" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "confidenceJson" JSONB NOT NULL DEFAULT '{}',
    "computedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cause_confidences_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "impact_assessments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "rootCauseId" UUID NOT NULL,
    "revenueImpact" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "profitImpact" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "operationalImpact" INTEGER NOT NULL DEFAULT 0,
    "customerImpact" INTEGER NOT NULL DEFAULT 0,
    "urgency" INTEGER NOT NULL DEFAULT 0,
    "impactJson" JSONB NOT NULL DEFAULT '{}',
    "computedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "impact_assessments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "causal_graph_edges" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "edgeKey" VARCHAR(120) NOT NULL,
    "fromNodeId" VARCHAR(100) NOT NULL,
    "toNodeId" VARCHAR(100) NOT NULL,
    "relationLabel" VARCHAR(100) NOT NULL,
    "evidenceIds" JSONB NOT NULL DEFAULT '[]',
    "edgeJson" JSONB NOT NULL DEFAULT '{}',
    "confidence" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "causal_graph_edges_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "root_cause_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "rootCauseId" UUID NOT NULL,
    "changeType" VARCHAR(50) NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "root_cause_history_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "root_cause_store_key_unique" ON "root_causes"("storeId", "causeKey");
CREATE INDEX "root_cause_store_rank_idx" ON "root_causes"("storeId", "active", "rankScore");
CREATE UNIQUE INDEX "causal_chain_store_key_unique" ON "causal_chains"("storeId", "chainKey");
CREATE UNIQUE INDEX "causal_timeline_store_key_unique" ON "causal_timelines"("storeId", "timelineKey");
CREATE UNIQUE INDEX "signal_correlation_store_key_unique" ON "signal_correlations"("storeId", "correlationKey");
CREATE INDEX "signal_correlation_store_computed_idx" ON "signal_correlations"("storeId", "computedAt");
CREATE INDEX "cause_confidence_store_computed_idx" ON "cause_confidences"("storeId", "computedAt");
CREATE INDEX "impact_assessment_store_computed_idx" ON "impact_assessments"("storeId", "computedAt");
CREATE UNIQUE INDEX "causal_graph_edge_store_key_unique" ON "causal_graph_edges"("storeId", "edgeKey");
CREATE INDEX "root_cause_history_store_changed_idx" ON "root_cause_history"("storeId", "changedAt");

ALTER TABLE "root_causes" ADD CONSTRAINT "root_causes_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "causal_chains" ADD CONSTRAINT "causal_chains_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "causal_chains" ADD CONSTRAINT "causal_chains_rootCauseId_fkey" FOREIGN KEY ("rootCauseId") REFERENCES "root_causes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "causal_timelines" ADD CONSTRAINT "causal_timelines_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "causal_timelines" ADD CONSTRAINT "causal_timelines_rootCauseId_fkey" FOREIGN KEY ("rootCauseId") REFERENCES "root_causes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "signal_correlations" ADD CONSTRAINT "signal_correlations_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cause_confidences" ADD CONSTRAINT "cause_confidences_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cause_confidences" ADD CONSTRAINT "cause_confidences_rootCauseId_fkey" FOREIGN KEY ("rootCauseId") REFERENCES "root_causes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "impact_assessments" ADD CONSTRAINT "impact_assessments_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "impact_assessments" ADD CONSTRAINT "impact_assessments_rootCauseId_fkey" FOREIGN KEY ("rootCauseId") REFERENCES "root_causes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "causal_graph_edges" ADD CONSTRAINT "causal_graph_edges_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "root_cause_history" ADD CONSTRAINT "root_cause_history_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "root_cause_history" ADD CONSTRAINT "root_cause_history_rootCauseId_fkey" FOREIGN KEY ("rootCauseId") REFERENCES "root_causes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
