import type { Prisma } from "@prisma/client";

import prisma from "../../db.server";
import { assertJsonPayloadFreeOfCustomerPii } from "../../lib/json-pii-guard.server";
import { computeAdaptiveScore } from "../adaptive-score/adaptive-scorer";
import { buildBusinessDnaV3 } from "../business-dna/dna-v3-builder";
import { evolveConfidence } from "../confidence/confidence-evolution";
import { ingestIntelligenceEvents } from "../decision-journal/journal-ingest";
import { detectMerchantBehavior } from "../merchant-behavior/behavior-engine";
import {
  buildAdaptiveMemoryPatches,
  buildMemoryUpdate,
} from "../memory-update/memory-updater";
import { buildPersonalizationProfile } from "../personalization/personalization-engine";
import {
  learnFromExperiments,
  learnFromPredictions,
  learnFromRecommendations,
  learnFromRootCauses,
} from "../recommendation-learning/recommendation-learner";
import { buildLearningAttribution } from "../shared/learning-attribution";
import type { MerchantIntelligenceResult } from "../shared/types";
import {
  buildDecisionTimelines,
  buildMerchantTimeline,
} from "../timeline/timeline-engine";
import { loadMerchantIntelligenceContext } from "./merchant-intelligence-context-loader";

export async function runMerchantIntelligence(
  storeId: string,
): Promise<MerchantIntelligenceResult> {
  const context = await loadMerchantIntelligenceContext(storeId);
  const entries = ingestIntelligenceEvents(context).map((e) => ({ ...e, processed: true }));

  const behavior = detectMerchantBehavior(entries, context);
  const personalization = buildPersonalizationProfile(behavior);
  const recommendationOutcomes = learnFromRecommendations(entries);
  const predictionLearning = learnFromPredictions(entries);
  const experimentLearning = learnFromExperiments(entries);
  const rootCauseLearning = learnFromRootCauses(entries);
  const confidenceRecords = evolveConfidence({ context, entries });

  const latestMemory = await prisma.businessMemoryVersion.findFirst({
    where: { storeId },
    orderBy: { versionNumber: "desc" },
  });
  const memoryVersionNumber = (latestMemory?.versionNumber ?? 0) + 1;
  const dnaVersionNumber = context.businessDnaVersion + 1;

  const adaptiveScoreRecord = computeAdaptiveScore({
    context,
    entries,
    memoryVersionNumber,
    dnaVersionNumber,
  });

  const dnaV3 = buildBusinessDnaV3({
    context,
    behavior,
    personalization,
    journalCount: entries.length,
    adaptiveScore: adaptiveScoreRecord.score,
    nextVersion: dnaVersionNumber,
  });

  const memoryUpdate = buildMemoryUpdate(context, memoryVersionNumber);
  const memoryPatches = buildAdaptiveMemoryPatches(context);
  const timelineEvents = buildMerchantTimeline(entries, {
    dnaVersion: dnaVersionNumber,
    memoryVersion: memoryVersionNumber,
    adaptiveScore: adaptiveScoreRecord.score,
  });
  const decisionTimelines = buildDecisionTimelines(entries);

  const attributions = entries.slice(0, 20).map((entry, index) =>
    buildLearningAttribution({
      attributionKey: `attr:${entry.journalKey}:${index}`,
      businessOutcome: entry.outcome || entry.title,
      journalKey: entry.journalKey,
      evidenceIds: entry.evidenceIds,
      graphNodeIds: entry.graphNodeIds,
      merchantAction: entry.merchantAction,
      learningUpdateType: "memory",
      memoryVersionNumber,
      dnaVersionNumber,
      futureImpact: { domain: entry.decisionType },
    }),
  );

  await persistMerchantIntelligence({
    storeId,
    entries,
    behavior,
    personalization,
    recommendationOutcomes,
    predictionLearning,
    experimentLearning,
    rootCauseLearning,
    confidenceRecords,
    adaptiveScoreRecord,
    dnaV3,
    memoryUpdate,
    memoryPatches,
    timelineEvents,
    decisionTimelines,
    attributions,
  });

  await advanceMerchantIntelligenceReadiness(storeId, adaptiveScoreRecord.score);

  return {
    success: true,
    storeId,
    journalEntriesProcessed: entries.length,
    adaptiveScore: adaptiveScoreRecord.score,
    memoryVersionNumber,
    dnaVersionNumber,
    attributionCount: attributions.length,
  };
}

async function persistMerchantIntelligence(input: {
  storeId: string;
  entries: ReturnType<typeof ingestIntelligenceEvents>;
  behavior: ReturnType<typeof detectMerchantBehavior>;
  personalization: ReturnType<typeof buildPersonalizationProfile>;
  recommendationOutcomes: ReturnType<typeof learnFromRecommendations>;
  predictionLearning: ReturnType<typeof learnFromPredictions>;
  experimentLearning: ReturnType<typeof learnFromExperiments>;
  rootCauseLearning: ReturnType<typeof learnFromRootCauses>;
  confidenceRecords: ReturnType<typeof evolveConfidence>;
  adaptiveScoreRecord: ReturnType<typeof computeAdaptiveScore>;
  dnaV3: ReturnType<typeof buildBusinessDnaV3>;
  memoryUpdate: ReturnType<typeof buildMemoryUpdate>;
  memoryPatches: ReturnType<typeof buildAdaptiveMemoryPatches>;
  timelineEvents: ReturnType<typeof buildMerchantTimeline>;
  decisionTimelines: ReturnType<typeof buildDecisionTimelines>;
  attributions: ReturnType<typeof buildLearningAttribution>[];
}): Promise<void> {
  assertJsonPayloadFreeOfCustomerPii(input, "MerchantIntelligence.persist");
  await prisma.$transaction(async (tx) => {
    for (const entry of input.entries) {
      await tx.decisionJournal.upsert({
        where: {
          storeId_journalKey: { storeId: input.storeId, journalKey: entry.journalKey },
        },
        create: {
          store: { connect: { id: input.storeId } },
          journalKey: entry.journalKey,
          decisionType: entry.decisionType,
          sourceId: entry.sourceId,
          title: entry.title,
          recommendation: entry.recommendation,
          evidenceIds: entry.evidenceIds as Prisma.InputJsonValue,
          graphNodeIds: entry.graphNodeIds as Prisma.InputJsonValue,
          memoryIds: entry.memoryIds as Prisma.InputJsonValue,
          merchantAction: entry.merchantAction,
          businessContext: entry.businessContext as Prisma.InputJsonValue,
          outcome: entry.outcome,
          revenueImpact: entry.revenueImpact,
          profitImpact: entry.profitImpact,
          confidenceBefore: entry.confidenceBefore,
          confidenceAfter: entry.confidenceAfter,
          relatedRootCauseId: entry.relatedRootCauseId,
          relatedPredictionId: entry.relatedPredictionId,
          relatedExperimentId: entry.relatedExperimentId,
          processed: true,
        },
        update: {
          merchantAction: entry.merchantAction,
          confidenceAfter: entry.confidenceAfter,
          outcome: entry.outcome,
          processed: true,
        },
      });

      if (entry.merchantAction !== "pending") {
        await tx.merchantDecision.create({
          data: {
            storeId: input.storeId,
            journalId: entry.journalKey,
            decisionType: entry.decisionType,
            action: entry.merchantAction,
            actionJson: entry.businessContext as Prisma.InputJsonValue,
          },
        });
      }
    }

    await tx.merchantBehaviorProfile.upsert({
      where: { storeId: input.storeId },
      create: {
        store: { connect: { id: input.storeId } },
        ...input.behavior,
        profileJson: input.behavior as Prisma.InputJsonValue,
      },
      update: {
        ...input.behavior,
        profileJson: input.behavior as Prisma.InputJsonValue,
        lastComputedAt: new Date(),
      },
    });

    await tx.personalizationProfile.upsert({
      where: { storeId: input.storeId },
      create: {
        store: { connect: { id: input.storeId } },
        priorityDomains: input.personalization.priorityDomains as Prisma.InputJsonValue,
        deprioritizedDomains: input.personalization.deprioritizedDomains as Prisma.InputJsonValue,
        decisionStyle: input.personalization.decisionStyle,
        riskTolerance: input.personalization.riskTolerance,
        automationReadiness: input.personalization.automationReadiness,
        profileJson: input.personalization as Prisma.InputJsonValue,
      },
      update: {
        priorityDomains: input.personalization.priorityDomains as Prisma.InputJsonValue,
        deprioritizedDomains: input.personalization.deprioritizedDomains as Prisma.InputJsonValue,
        decisionStyle: input.personalization.decisionStyle,
        riskTolerance: input.personalization.riskTolerance,
        automationReadiness: input.personalization.automationReadiness,
        profileJson: input.personalization as Prisma.InputJsonValue,
        lastComputedAt: new Date(),
      },
    });

    for (const outcome of input.recommendationOutcomes) {
      await tx.recommendationOutcome.upsert({
        where: {
          storeId_outcomeKey: { storeId: input.storeId, outcomeKey: outcome.outcomeKey },
        },
        create: { storeId: input.storeId, ...outcome, outcomeJson: outcome as Prisma.InputJsonValue },
        update: { ...outcome, outcomeJson: outcome as Prisma.InputJsonValue, recordedAt: new Date() },
      });
    }

    for (const pred of input.predictionLearning) {
      await tx.predictionAccuracyRecord.upsert({
        where: {
          storeId_accuracyKey: { storeId: input.storeId, accuracyKey: pred.accuracyKey },
        },
        create: {
          storeId: input.storeId,
          accuracyKey: pred.accuracyKey,
          predictionId: pred.predictionId,
          predictedValue: pred.predictedValue,
          actualValue: pred.actualValue,
          variance: pred.variance,
          accuracyScore: pred.accuracyScore,
          confidenceChange: pred.confidenceChange,
          accuracyJson: pred as Prisma.InputJsonValue,
        },
        update: {
          actualValue: pred.actualValue,
          variance: pred.variance,
          accuracyScore: pred.accuracyScore,
          confidenceChange: pred.confidenceChange,
          evaluatedAt: new Date(),
        },
      });

      await tx.predictionValidation.upsert({
        where: {
          storeId_validationKey: {
            storeId: input.storeId,
            validationKey: `val:${pred.accuracyKey}`,
          },
        },
        create: {
          storeId: input.storeId,
          validationKey: `val:${pred.accuracyKey}`,
          predictionId: pred.predictionId,
          merchantAction: pred.merchantAction,
          validated: pred.merchantAction === "confirmed",
          confidenceDelta: pred.confidenceChange,
          validationJson: pred as Prisma.InputJsonValue,
        },
        update: {
          merchantAction: pred.merchantAction,
          validated: pred.merchantAction === "confirmed",
          confidenceDelta: pred.confidenceChange,
          validatedAt: new Date(),
        },
      });
    }

    for (const rc of input.rootCauseLearning) {
      await tx.rootCauseValidation.upsert({
        where: {
          storeId_validationKey: { storeId: input.storeId, validationKey: rc.validationKey },
        },
        create: {
          storeId: input.storeId,
          ...rc,
          validationJson: rc as Prisma.InputJsonValue,
        },
        update: {
          merchantAction: rc.merchantAction,
          confirmed: rc.confirmed,
          confidenceDelta: rc.confidenceDelta,
          validatedAt: new Date(),
        },
      });
    }

    for (const conf of input.confidenceRecords) {
      await tx.adaptiveConfidence.upsert({
        where: {
          storeId_confidenceKey: { storeId: input.storeId, confidenceKey: conf.confidenceKey },
        },
        create: {
          storeId: input.storeId,
          ...conf,
          confidenceJson: conf as Prisma.InputJsonValue,
        },
        update: {
          ...conf,
          confidenceJson: conf as Prisma.InputJsonValue,
          computedAt: new Date(),
        },
      });
    }

    await tx.adaptiveScore.upsert({
      where: { storeId: input.storeId },
      create: {
        store: { connect: { id: input.storeId } },
        score: input.adaptiveScoreRecord.score,
        merchantParticipationScore: input.adaptiveScoreRecord.merchantParticipationScore,
        journalCoverageScore: input.adaptiveScoreRecord.journalCoverageScore,
        experimentCompletionScore: input.adaptiveScoreRecord.experimentCompletionScore,
        recommendationAcceptanceScore: input.adaptiveScoreRecord.recommendationAcceptanceScore,
        predictionAccuracyScore: input.adaptiveScoreRecord.predictionAccuracyScore,
        confidenceQualityScore: input.adaptiveScoreRecord.confidenceQualityScore,
        memoryCoverageScore: input.adaptiveScoreRecord.memoryCoverageScore,
        learningFreshnessScore: input.adaptiveScoreRecord.learningFreshnessScore,
        dnaMaturityScore: input.adaptiveScoreRecord.dnaMaturityScore,
        merchantFeedbackScore: input.adaptiveScoreRecord.merchantFeedbackScore,
        cooImprovementScore: input.adaptiveScoreRecord.cooImprovementScore,
        scoreJson: input.adaptiveScoreRecord as Prisma.InputJsonValue,
      },
      update: {
        score: input.adaptiveScoreRecord.score,
        merchantParticipationScore: input.adaptiveScoreRecord.merchantParticipationScore,
        journalCoverageScore: input.adaptiveScoreRecord.journalCoverageScore,
        experimentCompletionScore: input.adaptiveScoreRecord.experimentCompletionScore,
        recommendationAcceptanceScore: input.adaptiveScoreRecord.recommendationAcceptanceScore,
        predictionAccuracyScore: input.adaptiveScoreRecord.predictionAccuracyScore,
        confidenceQualityScore: input.adaptiveScoreRecord.confidenceQualityScore,
        memoryCoverageScore: input.adaptiveScoreRecord.memoryCoverageScore,
        learningFreshnessScore: input.adaptiveScoreRecord.learningFreshnessScore,
        dnaMaturityScore: input.adaptiveScoreRecord.dnaMaturityScore,
        merchantFeedbackScore: input.adaptiveScoreRecord.merchantFeedbackScore,
        cooImprovementScore: input.adaptiveScoreRecord.cooImprovementScore,
        scoreJson: input.adaptiveScoreRecord as Prisma.InputJsonValue,
        lastComputedAt: new Date(),
      },
    });

    await tx.businessDnaVersion.create({
      data: {
        storeId: input.storeId,
        versionNumber: input.dnaV3.versionNumber,
        dnaJson: input.dnaV3 as Prisma.InputJsonValue,
        confidenceScore: input.dnaV3.confidenceScore,
      },
    });

    await tx.businessMemoryVersion.create({
      data: {
        storeId: input.storeId,
        versionNumber: input.memoryUpdate.versionNumber,
        memoryJson: input.memoryUpdate.memoryJson as Prisma.InputJsonValue,
        patternCount: input.memoryUpdate.patternCount,
        confidenceScore: input.memoryUpdate.confidenceScore,
      },
    });

    for (const patch of input.memoryPatches) {
      await tx.adaptiveMemory.upsert({
        where: {
          storeId_memoryKey: { storeId: input.storeId, memoryKey: patch.memoryKey },
        },
        create: {
          storeId: input.storeId,
          memoryKey: patch.memoryKey,
          memoryType: patch.memoryType,
          memoryJson: patch.memoryJson as Prisma.InputJsonValue,
          confidence: patch.confidence,
          evidenceIds: patch.evidenceIds as Prisma.InputJsonValue,
        },
        update: {
          memoryJson: patch.memoryJson as Prisma.InputJsonValue,
          confidence: patch.confidence,
          versionNumber: { increment: 1 },
          lastUpdatedAt: new Date(),
        },
      });
    }

    for (const event of input.timelineEvents.slice(0, 30)) {
      await tx.merchantTimeline.upsert({
        where: {
          storeId_eventKey: { storeId: input.storeId, eventKey: event.eventKey },
        },
        create: {
          storeId: input.storeId,
          eventKey: event.eventKey,
          eventCategory: event.eventCategory,
          title: event.title,
          eventJson: event.eventJson as Prisma.InputJsonValue,
          occurredAt: new Date(event.occurredAt),
        },
        update: {
          title: event.title,
          eventJson: event.eventJson as Prisma.InputJsonValue,
        },
      });
    }

    for (const dt of input.decisionTimelines.slice(0, 30)) {
      await tx.decisionTimeline.upsert({
        where: {
          storeId_timelineKey: { storeId: input.storeId, timelineKey: dt.timelineKey },
        },
        create: {
          storeId: input.storeId,
          timelineKey: dt.timelineKey,
          journalKey: dt.journalKey,
          eventType: dt.eventType,
          eventJson: dt.eventJson as Prisma.InputJsonValue,
        },
        update: {
          eventJson: dt.eventJson as Prisma.InputJsonValue,
          occurredAt: new Date(),
        },
      });
    }

    for (const attr of input.attributions) {
      await tx.learningAttribution.upsert({
        where: {
          storeId_attributionKey: { storeId: input.storeId, attributionKey: attr.attributionKey },
        },
        create: {
          storeId: input.storeId,
          ...attr,
          attributionJson: attr.attributionJson as Prisma.InputJsonValue,
        },
        update: {
          attributionJson: attr.attributionJson as Prisma.InputJsonValue,
        },
      });
    }

    await tx.learningHistory.create({
      data: {
        storeId: input.storeId,
        updateType: "adaptive_score",
        updateKey: `refresh:${Date.now()}`,
        snapshot: input.adaptiveScoreRecord as Prisma.InputJsonValue,
      },
    });

    await tx.learningSnapshot.upsert({
      where: {
        storeId_snapshotKey: { storeId: input.storeId, snapshotKey: "merchant_intel" },
      },
      create: {
        storeId: input.storeId,
        snapshotKey: "merchant_intel",
        checkpointJson: {
          journalCount: input.entries.length,
          adaptiveScore: input.adaptiveScoreRecord.score,
          memoryVersion: input.memoryUpdate.versionNumber,
          dnaVersion: input.dnaV3.versionNumber,
        } as Prisma.InputJsonValue,
      },
      update: {
        checkpointJson: {
          journalCount: input.entries.length,
          adaptiveScore: input.adaptiveScoreRecord.score,
          memoryVersion: input.memoryUpdate.versionNumber,
          dnaVersion: input.dnaV3.versionNumber,
        } as Prisma.InputJsonValue,
        versionNumber: { increment: 1 },
      },
    });
  });
}

async function advanceMerchantIntelligenceReadiness(
  storeId: string,
  adaptiveScore: number,
): Promise<void> {
  await prisma.learningReadiness.upsert({
    where: { storeId },
    create: {
      storeId,
      stage: "adaptive",
      merchantIntelligenceReady: true,
      merchantMessage:
        "Adaptive intelligence is active. StorePilot learns from every decision and outcome.",
      stageExplanation: `Adaptive Intelligence score is ${adaptiveScore}/100.`,
      lastComputedAt: new Date(),
    },
    update: {
      stage: "adaptive",
      merchantIntelligenceReady: true,
      merchantMessage:
        "Adaptive intelligence is active. StorePilot learns from every decision and outcome.",
      stageExplanation: `Adaptive Intelligence score is ${adaptiveScore}/100. Business Memory and DNA updated.`,
      lastComputedAt: new Date(),
    },
  });
}

export { runMerchantIntelligence as refreshMerchantProfile };
