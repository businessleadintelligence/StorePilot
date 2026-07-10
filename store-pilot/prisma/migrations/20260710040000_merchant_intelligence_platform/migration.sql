-- AlterEnum
ALTER TYPE "JobType" ADD VALUE 'merchant_intelligence_refresh';

-- AlterTable
ALTER TABLE "learning_readiness" ADD COLUMN "merchantIntelligenceReady" BOOLEAN NOT NULL DEFAULT false;

-- CreateEnum
CREATE TYPE "DecisionJournalType" AS ENUM ('recommendation', 'prediction', 'experiment', 'root_cause', 'executive_decision', 'quick_win');
CREATE TYPE "MerchantActionType" AS ENUM ('accepted', 'rejected', 'ignored', 'deferred', 'partially_implemented', 'expired', 'cancelled', 'approved', 'dismissed', 'confirmed', 'disputed', 'pending');
CREATE TYPE "LearningUpdateType" AS ENUM ('confidence', 'memory', 'dna', 'personalization', 'adaptive_score', 'prediction_accuracy', 'behavior');

-- CreateTable decision_journal and related (see prisma schema for full definitions)
CREATE TABLE "decision_journal" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "journalKey" VARCHAR(120) NOT NULL,
    "decisionType" "DecisionJournalType" NOT NULL,
    "sourceId" VARCHAR(120) NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "recommendation" VARCHAR(500) NOT NULL DEFAULT '',
    "evidenceIds" JSONB NOT NULL DEFAULT '[]',
    "graphNodeIds" JSONB NOT NULL DEFAULT '[]',
    "memoryIds" JSONB NOT NULL DEFAULT '[]',
    "merchantAction" "MerchantActionType" NOT NULL DEFAULT 'pending',
    "businessContext" JSONB NOT NULL DEFAULT '{}',
    "merchantFeedback" JSONB NOT NULL DEFAULT '{}',
    "outcome" VARCHAR(300) NOT NULL DEFAULT '',
    "revenueImpact" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "profitImpact" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "confidenceBefore" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "confidenceAfter" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "relatedTimelineId" VARCHAR(120) NOT NULL DEFAULT '',
    "relatedRootCauseId" VARCHAR(120) NOT NULL DEFAULT '',
    "relatedPredictionId" VARCHAR(120) NOT NULL DEFAULT '',
    "relatedExperimentId" VARCHAR(120) NOT NULL DEFAULT '',
    "journalJson" JSONB NOT NULL DEFAULT '{}',
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "decision_journal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "merchant_decisions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "journalId" VARCHAR(120) NOT NULL,
    "decisionType" "DecisionJournalType" NOT NULL,
    "action" "MerchantActionType" NOT NULL,
    "actionJson" JSONB NOT NULL DEFAULT '{}',
    "decidedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "merchant_decisions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "merchant_feedback" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "journalKey" VARCHAR(120) NOT NULL,
    "feedbackType" VARCHAR(100) NOT NULL,
    "feedbackText" VARCHAR(500) NOT NULL DEFAULT '',
    "feedbackJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "merchant_feedback_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "adaptive_memory" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "memoryKey" VARCHAR(120) NOT NULL,
    "memoryType" VARCHAR(100) NOT NULL,
    "memoryJson" JSONB NOT NULL,
    "confidence" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "evidenceIds" JSONB NOT NULL DEFAULT '[]',
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "lastUpdatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "adaptive_memory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recommendation_outcomes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "outcomeKey" VARCHAR(120) NOT NULL,
    "sourceId" VARCHAR(120) NOT NULL,
    "recommendationType" "DecisionJournalType" NOT NULL DEFAULT 'recommendation',
    "merchantAction" "MerchantActionType" NOT NULL,
    "revenueImpactPct" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "confidenceBefore" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "confidenceAfter" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "outcomeJson" JSONB NOT NULL DEFAULT '{}',
    "recordedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "recommendation_outcomes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "prediction_accuracy" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "accuracyKey" VARCHAR(120) NOT NULL,
    "predictionId" VARCHAR(120) NOT NULL,
    "predictedValue" DECIMAL(12,4) NOT NULL,
    "actualValue" DECIMAL(12,4),
    "variance" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "accuracyScore" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "timeDifferenceDays" INTEGER NOT NULL DEFAULT 0,
    "confidenceChange" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "accuracyJson" JSONB NOT NULL DEFAULT '{}',
    "evaluatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "prediction_accuracy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "prediction_validation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "validationKey" VARCHAR(120) NOT NULL,
    "predictionId" VARCHAR(120) NOT NULL,
    "merchantAction" "MerchantActionType" NOT NULL,
    "validated" BOOLEAN NOT NULL DEFAULT false,
    "confidenceDelta" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "validationJson" JSONB NOT NULL DEFAULT '{}',
    "validatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "prediction_validation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "root_cause_validation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "validationKey" VARCHAR(120) NOT NULL,
    "rootCauseId" VARCHAR(120) NOT NULL,
    "merchantAction" "MerchantActionType" NOT NULL,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "confidenceDelta" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "validationJson" JSONB NOT NULL DEFAULT '{}',
    "validatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "root_cause_validation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "merchant_preferences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "preferenceKey" VARCHAR(120) NOT NULL,
    "domain" VARCHAR(100) NOT NULL,
    "preferenceValue" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "observationCount" INTEGER NOT NULL DEFAULT 0,
    "preferenceJson" JSONB NOT NULL DEFAULT '{}',
    "lastUpdatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "merchant_preferences_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "merchant_behavior_profiles" (
    "storeId" UUID NOT NULL,
    "acceptsPricingChanges" DECIMAL(5,4) NOT NULL DEFAULT 0.5,
    "rejectsInventoryChanges" DECIMAL(5,4) NOT NULL DEFAULT 0.5,
    "ignoresSeo" DECIMAL(5,4) NOT NULL DEFAULT 0.5,
    "prefersAutomation" DECIMAL(5,4) NOT NULL DEFAULT 0.5,
    "acceptsHighConfidenceOnly" DECIMAL(5,4) NOT NULL DEFAULT 0.5,
    "approvesWeekendExperiments" DECIMAL(5,4) NOT NULL DEFAULT 0.5,
    "actsQuickly" DECIMAL(5,4) NOT NULL DEFAULT 0.5,
    "delaysDecisions" DECIMAL(5,4) NOT NULL DEFAULT 0.5,
    "prefersLowRisk" DECIMAL(5,4) NOT NULL DEFAULT 0.5,
    "prefersLongTermGrowth" DECIMAL(5,4) NOT NULL DEFAULT 0.5,
    "prefersOperationalEfficiency" DECIMAL(5,4) NOT NULL DEFAULT 0.5,
    "profileJson" JSONB NOT NULL DEFAULT '{}',
    "lastComputedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "merchant_behavior_profiles_pkey" PRIMARY KEY ("storeId")
);

CREATE TABLE "personalization_profiles" (
    "storeId" UUID NOT NULL,
    "priorityDomains" JSONB NOT NULL DEFAULT '[]',
    "deprioritizedDomains" JSONB NOT NULL DEFAULT '[]',
    "decisionStyle" VARCHAR(100) NOT NULL DEFAULT 'balanced',
    "riskTolerance" VARCHAR(50) NOT NULL DEFAULT 'medium',
    "automationReadiness" DECIMAL(5,4) NOT NULL DEFAULT 0.5,
    "profileJson" JSONB NOT NULL DEFAULT '{}',
    "lastComputedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "personalization_profiles_pkey" PRIMARY KEY ("storeId")
);

CREATE TABLE "adaptive_confidence" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "confidenceKey" VARCHAR(120) NOT NULL,
    "domain" VARCHAR(100) NOT NULL,
    "confidenceScore" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "observationCount" INTEGER NOT NULL DEFAULT 0,
    "historicalSupport" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "merchantValidation" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "outcomeAccuracy" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "timeDecay" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "evidenceQuality" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "freshness" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "businessStability" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "confidenceJson" JSONB NOT NULL DEFAULT '{}',
    "computedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "adaptive_confidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "adaptive_score" (
    "storeId" UUID NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "merchantParticipationScore" INTEGER NOT NULL DEFAULT 0,
    "journalCoverageScore" INTEGER NOT NULL DEFAULT 0,
    "experimentCompletionScore" INTEGER NOT NULL DEFAULT 0,
    "recommendationAcceptanceScore" INTEGER NOT NULL DEFAULT 0,
    "predictionAccuracyScore" INTEGER NOT NULL DEFAULT 0,
    "confidenceQualityScore" INTEGER NOT NULL DEFAULT 0,
    "memoryCoverageScore" INTEGER NOT NULL DEFAULT 0,
    "learningFreshnessScore" INTEGER NOT NULL DEFAULT 0,
    "dnaMaturityScore" INTEGER NOT NULL DEFAULT 0,
    "merchantFeedbackScore" INTEGER NOT NULL DEFAULT 0,
    "cooImprovementScore" INTEGER NOT NULL DEFAULT 0,
    "scoreJson" JSONB NOT NULL DEFAULT '{}',
    "lastComputedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "adaptive_score_pkey" PRIMARY KEY ("storeId")
);

CREATE TABLE "decision_timelines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "timelineKey" VARCHAR(120) NOT NULL,
    "journalKey" VARCHAR(120) NOT NULL,
    "eventType" VARCHAR(100) NOT NULL,
    "eventJson" JSONB NOT NULL,
    "occurredAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "decision_timelines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "merchant_timeline" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "eventKey" VARCHAR(120) NOT NULL,
    "eventCategory" VARCHAR(100) NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "eventJson" JSONB NOT NULL,
    "occurredAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "merchant_timeline_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "business_memory_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "memoryJson" JSONB NOT NULL,
    "patternCount" INTEGER NOT NULL DEFAULT 0,
    "confidenceScore" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "business_memory_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "learning_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "updateType" "LearningUpdateType" NOT NULL,
    "updateKey" VARCHAR(120) NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "learning_history_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "learning_snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "snapshotKey" VARCHAR(120) NOT NULL,
    "checkpointJson" JSONB NOT NULL,
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "learning_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "learning_attributions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "attributionKey" VARCHAR(120) NOT NULL,
    "businessOutcome" VARCHAR(300) NOT NULL,
    "journalKey" VARCHAR(120) NOT NULL,
    "evidenceIds" JSONB NOT NULL DEFAULT '[]',
    "graphNodeIds" JSONB NOT NULL DEFAULT '[]',
    "merchantAction" "MerchantActionType" NOT NULL,
    "learningUpdateType" "LearningUpdateType" NOT NULL,
    "memoryVersionNumber" INTEGER NOT NULL DEFAULT 0,
    "dnaVersionNumber" INTEGER NOT NULL DEFAULT 0,
    "attributionJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "learning_attributions_pkey" PRIMARY KEY ("id")
);

-- Indexes and foreign keys
CREATE UNIQUE INDEX "decision_journal_store_key_unique" ON "decision_journal"("storeId", "journalKey");
CREATE INDEX "decision_journal_store_processed_idx" ON "decision_journal"("storeId", "processed", "createdAt");
CREATE INDEX "merchant_decision_store_decided_idx" ON "merchant_decisions"("storeId", "decidedAt");
CREATE INDEX "merchant_feedback_store_created_idx" ON "merchant_feedback"("storeId", "createdAt");
CREATE UNIQUE INDEX "adaptive_memory_store_key_unique" ON "adaptive_memory"("storeId", "memoryKey");
CREATE UNIQUE INDEX "recommendation_outcome_store_key_unique" ON "recommendation_outcomes"("storeId", "outcomeKey");
CREATE UNIQUE INDEX "prediction_accuracy_store_key_unique" ON "prediction_accuracy"("storeId", "accuracyKey");
CREATE UNIQUE INDEX "prediction_validation_store_key_unique" ON "prediction_validation"("storeId", "validationKey");
CREATE UNIQUE INDEX "root_cause_validation_store_key_unique" ON "root_cause_validation"("storeId", "validationKey");
CREATE UNIQUE INDEX "merchant_preference_store_key_unique" ON "merchant_preferences"("storeId", "preferenceKey");
CREATE UNIQUE INDEX "adaptive_confidence_store_key_unique" ON "adaptive_confidence"("storeId", "confidenceKey");
CREATE INDEX "adaptive_confidence_store_computed_idx" ON "adaptive_confidence"("storeId", "computedAt");
CREATE UNIQUE INDEX "decision_timeline_store_key_unique" ON "decision_timelines"("storeId", "timelineKey");
CREATE INDEX "decision_timeline_store_occurred_idx" ON "decision_timelines"("storeId", "occurredAt");
CREATE UNIQUE INDEX "merchant_timeline_store_key_unique" ON "merchant_timeline"("storeId", "eventKey");
CREATE INDEX "merchant_timeline_store_occurred_idx" ON "merchant_timeline"("storeId", "occurredAt");
CREATE UNIQUE INDEX "business_memory_version_store_unique" ON "business_memory_versions"("storeId", "versionNumber");
CREATE INDEX "learning_history_store_changed_idx" ON "learning_history"("storeId", "changedAt");
CREATE UNIQUE INDEX "learning_snapshot_store_key_unique" ON "learning_snapshots"("storeId", "snapshotKey");
CREATE UNIQUE INDEX "learning_attribution_store_key_unique" ON "learning_attributions"("storeId", "attributionKey");
CREATE INDEX "learning_attribution_store_created_idx" ON "learning_attributions"("storeId", "createdAt");

ALTER TABLE "decision_journal" ADD CONSTRAINT "decision_journal_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "merchant_decisions" ADD CONSTRAINT "merchant_decisions_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "merchant_feedback" ADD CONSTRAINT "merchant_feedback_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "adaptive_memory" ADD CONSTRAINT "adaptive_memory_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recommendation_outcomes" ADD CONSTRAINT "recommendation_outcomes_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "prediction_accuracy" ADD CONSTRAINT "prediction_accuracy_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "prediction_validation" ADD CONSTRAINT "prediction_validation_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "root_cause_validation" ADD CONSTRAINT "root_cause_validation_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "merchant_preferences" ADD CONSTRAINT "merchant_preferences_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "merchant_behavior_profiles" ADD CONSTRAINT "merchant_behavior_profiles_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "personalization_profiles" ADD CONSTRAINT "personalization_profiles_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "adaptive_confidence" ADD CONSTRAINT "adaptive_confidence_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "adaptive_score" ADD CONSTRAINT "adaptive_score_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "decision_timelines" ADD CONSTRAINT "decision_timelines_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "merchant_timeline" ADD CONSTRAINT "merchant_timeline_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "business_memory_versions" ADD CONSTRAINT "business_memory_versions_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learning_history" ADD CONSTRAINT "learning_history_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learning_snapshots" ADD CONSTRAINT "learning_snapshots_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learning_attributions" ADD CONSTRAINT "learning_attributions_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
