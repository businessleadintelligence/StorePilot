import type { Prisma } from "@prisma/client";

import prisma from "../../db.server";
import { computeExperimentConfidence } from "../confidence/experiment-confidence";
import { simulateShadowExperiment } from "../execution/shadow-simulator";
import {
  buildExperimentCompletedEvent,
  buildExperimentStartedEvent,
  createExperimentEventEmitter,
} from "../learning/learning-hooks";
import { planExperiments } from "../planner/experiment-planner";
import { detectExperimentOpportunities } from "../recommendations/opportunity-engine";
import type { ExperimentEngineResult, ExperimentRecord } from "../shared/types";
import { selectExperimentWinner } from "../winner-selection/winner-selector";
import { loadExperimentContext } from "./experiment-context-loader";

export async function runExperimentEngine(
  storeId: string,
): Promise<ExperimentEngineResult> {
  const context = await loadExperimentContext(storeId);
  const opportunities = detectExperimentOpportunities(context);
  const planned = planExperiments({ context, opportunities });

  const experiments: ExperimentRecord[] = [];
  const eventEmitter = createExperimentEventEmitter(() => undefined);

  for (const experiment of planned) {
    const shadow = simulateShadowExperiment({ experiment, context });
    const confidence = computeExperimentConfidence({
      experiment,
      context,
      observationCount: shadow.simulatedObservations.length,
    });
    const winner = selectExperimentWinner(shadow.comparisons);

    experiments.push({
      ...experiment,
      confidence: confidence.confidenceScore,
      shadowSimulationJson: shadow.shadowSimulationJson,
      expectedRevenueImpact: winner?.revenueImpact ?? experiment.expectedRevenueImpact,
      expectedProfitImpact: winner?.profitImpact ?? experiment.expectedProfitImpact,
    });
  }

  await persistExperimentEngine({
    storeId,
    context,
    opportunities,
    experiments,
    eventEmitter,
  });

  if (experiments.length > 0) {
    await advanceExperimentReadiness(storeId);
  }

  return {
    success: true,
    storeId,
    opportunityCount: opportunities.length,
    experimentCount: experiments.length,
    recommendationCount: Math.min(experiments.length, 5),
    topExperiment: experiments[0] ?? null,
  };
}

async function persistExperimentEngine(input: {
  storeId: string;
  context: Awaited<ReturnType<typeof loadExperimentContext>>;
  opportunities: ReturnType<typeof detectExperimentOpportunities>;
  experiments: ExperimentRecord[];
  eventEmitter: ReturnType<typeof createExperimentEventEmitter>;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.experiment.updateMany({
      where: { storeId: input.storeId, status: "shadow_simulated" },
      data: { active: false },
    });
    await tx.experimentOpportunity.updateMany({
      where: { storeId: input.storeId },
      data: { active: false },
    });
    await tx.experimentRecommendation.updateMany({
      where: { storeId: input.storeId },
      data: { active: false },
    });

    for (const opportunity of input.opportunities) {
      await tx.experimentOpportunity.upsert({
        where: {
          storeId_opportunityKey: {
            storeId: input.storeId,
            opportunityKey: opportunity.opportunityKey,
          },
        },
        create: {
          store: { connect: { id: input.storeId } },
          opportunityKey: opportunity.opportunityKey,
          domain: opportunity.domain,
          title: opportunity.title,
          businessProblem: opportunity.businessProblem,
          sourceType: opportunity.sourceType,
          sourceId: opportunity.sourceId,
          evidenceIds: opportunity.evidenceIds as Prisma.InputJsonValue,
          memoryIds: opportunity.memoryIds as Prisma.InputJsonValue,
          predictionIds: opportunity.predictionIds as Prisma.InputJsonValue,
          rootCauseIds: opportunity.rootCauseIds as Prisma.InputJsonValue,
          estimatedImpact: opportunity.estimatedImpact,
          confidence: opportunity.confidence,
          opportunityJson: opportunity as unknown as Prisma.InputJsonValue,
          active: true,
        },
        update: {
          title: opportunity.title,
          businessProblem: opportunity.businessProblem,
          estimatedImpact: opportunity.estimatedImpact,
          confidence: opportunity.confidence,
          opportunityJson: opportunity as unknown as Prisma.InputJsonValue,
          active: true,
        },
      });
    }

    const experimentIdByKey = new Map<string, string>();

    for (const experiment of input.experiments) {
      const row = await tx.experiment.upsert({
        where: {
          storeId_experimentKey: {
            storeId: input.storeId,
            experimentKey: experiment.experimentKey,
          },
        },
        create: mapExperimentCreate(input.storeId, experiment),
        update: mapExperimentUpdate(experiment),
      });
      experimentIdByKey.set(experiment.experimentKey, row.id);

      await tx.experimentTemplate.upsert({
        where: {
          storeId_templateKey: {
            storeId: input.storeId,
            templateKey: experiment.templateKey,
          },
        },
        create: {
          store: { connect: { id: input.storeId } },
          templateKey: experiment.templateKey,
          domain: experiment.experimentDomain,
          title: experiment.title,
          templateJson: {
            successMetrics: experiment.successMetrics,
            baselineMetrics: experiment.baselineMetrics,
          } as Prisma.InputJsonValue,
        },
        update: {
          title: experiment.title,
          templateJson: {
            successMetrics: experiment.successMetrics,
            baselineMetrics: experiment.baselineMetrics,
          } as Prisma.InputJsonValue,
          version: { increment: 1 },
        },
      });

      const baselineMetrics = experiment.baselineMetrics;
      await tx.experimentBaseline.upsert({
        where: {
          storeId_baselineKey: {
            storeId: input.storeId,
            baselineKey: `${experiment.experimentKey}:baseline`,
          },
        },
        create: {
          store: { connect: { id: input.storeId } },
          experiment: { connect: { id: row.id } },
          baselineKey: `${experiment.experimentKey}:baseline`,
          revenue: baselineMetrics.revenue,
          conversion: baselineMetrics.conversion,
          ctr: baselineMetrics.ctr,
          inventory: baselineMetrics.inventory,
          traffic: baselineMetrics.traffic,
          seoScore: baselineMetrics.seoScore,
          refunds: baselineMetrics.refunds,
          aov: baselineMetrics.aov,
          margin: baselineMetrics.margin,
          baselineJson: baselineMetrics as Prisma.InputJsonValue,
        },
        update: {
          revenue: baselineMetrics.revenue,
          conversion: baselineMetrics.conversion,
          ctr: baselineMetrics.ctr,
          inventory: baselineMetrics.inventory,
          traffic: baselineMetrics.traffic,
          seoScore: baselineMetrics.seoScore,
          refunds: baselineMetrics.refunds,
          aov: baselineMetrics.aov,
          margin: baselineMetrics.margin,
          baselineJson: baselineMetrics as Prisma.InputJsonValue,
          capturedAt: new Date(),
        },
      });

      for (const variant of experiment.variants) {
        await tx.experimentVariant.upsert({
          where: {
            storeId_variantKey: {
              storeId: input.storeId,
              variantKey: `${experiment.experimentKey}:${variant.variantKey}`,
            },
          },
          create: {
            store: { connect: { id: input.storeId } },
            experiment: { connect: { id: row.id } },
            variantKey: `${experiment.experimentKey}:${variant.variantKey}`,
            variantLabel: variant.variantLabel,
            currentValue: variant.currentValue,
            proposedValue: variant.proposedValue,
            variantJson: variant as Prisma.InputJsonValue,
            isControl: variant.isControl,
          },
          update: {
            variantLabel: variant.variantLabel,
            currentValue: variant.currentValue,
            proposedValue: variant.proposedValue,
            variantJson: variant as Prisma.InputJsonValue,
            isControl: variant.isControl,
          },
        });
      }

      const shadow = experiment.shadowSimulationJson as {
        comparisons?: Array<{
          variantKey: string;
          metricKey: string;
          baselineValue: number;
          variantValue: number;
          difference: number;
          differencePct: number;
          confidence: number;
        }>;
      };

      for (const comparison of shadow.comparisons ?? []) {
        await tx.experimentResult.upsert({
          where: {
            storeId_resultKey: {
              storeId: input.storeId,
              resultKey: `${experiment.experimentKey}:${comparison.variantKey}:${comparison.metricKey}`,
            },
          },
          create: {
            store: { connect: { id: input.storeId } },
            experiment: { connect: { id: row.id } },
            resultKey: `${experiment.experimentKey}:${comparison.variantKey}:${comparison.metricKey}`,
            variantKey: comparison.variantKey,
            metricKey: comparison.metricKey,
            baselineValue: comparison.baselineValue,
            variantValue: comparison.variantValue,
            difference: comparison.difference,
            differencePct: comparison.differencePct,
            confidence: comparison.confidence,
            resultJson: comparison as Prisma.InputJsonValue,
          },
          update: {
            baselineValue: comparison.baselineValue,
            variantValue: comparison.variantValue,
            difference: comparison.difference,
            differencePct: comparison.differencePct,
            confidence: comparison.confidence,
            resultJson: comparison as Prisma.InputJsonValue,
            computedAt: new Date(),
          },
        });

        await tx.experimentObservation.upsert({
          where: {
            storeId_observationKey: {
              storeId: input.storeId,
              observationKey: `${experiment.experimentKey}:${comparison.variantKey}:shadow`,
            },
          },
          create: {
            store: { connect: { id: input.storeId } },
            experiment: { connect: { id: row.id } },
            observationKey: `${experiment.experimentKey}:${comparison.variantKey}:shadow`,
            variantKey: comparison.variantKey,
            revenue: comparison.variantValue,
            conversion: experiment.baselineMetrics.conversion,
            ctr: experiment.baselineMetrics.ctr,
            refunds: experiment.baselineMetrics.refunds,
            inventory: experiment.baselineMetrics.inventory,
            traffic: experiment.baselineMetrics.traffic,
            profit: comparison.difference * 0.35,
            margin: experiment.baselineMetrics.margin,
            observationJson: { simulated: true } as Prisma.InputJsonValue,
          },
          update: {
            revenue: comparison.variantValue,
            profit: comparison.difference * 0.35,
            observedAt: new Date(),
          },
        });
      }

      const winner = selectExperimentWinner(shadow.comparisons ?? []);
      if (winner) {
        await tx.experimentWinner.upsert({
          where: {
            storeId_winnerKey: {
              storeId: input.storeId,
              winnerKey: `${experiment.experimentKey}:winner`,
            },
          },
          create: {
            store: { connect: { id: input.storeId } },
            experiment: { connect: { id: row.id } },
            winnerKey: `${experiment.experimentKey}:winner`,
            variantKey: winner.variantKey,
            outcome: winner.outcome,
            confidence: winner.confidence,
            revenueImpact: winner.revenueImpact,
            profitImpact: winner.profitImpact,
            winnerJson: winner as Prisma.InputJsonValue,
          },
          update: {
            variantKey: winner.variantKey,
            outcome: winner.outcome,
            confidence: winner.confidence,
            revenueImpact: winner.revenueImpact,
            profitImpact: winner.profitImpact,
            winnerJson: winner as Prisma.InputJsonValue,
            selectedAt: new Date(),
          },
        });
      }

      const confidenceBreakdown = computeExperimentConfidence({
        experiment,
        context: input.context,
        observationCount: (shadow.comparisons ?? []).length,
      });

      await tx.experimentConfidence.create({
        data: {
          storeId: input.storeId,
          experimentId: row.id,
          confidenceScore: confidenceBreakdown.confidenceScore,
          observationCount: confidenceBreakdown.observationCount,
          dataCoverage: confidenceBreakdown.dataCoverage,
          businessStability: confidenceBreakdown.businessStability,
          historicalSupport: confidenceBreakdown.historicalSupport,
          merchantSimilarity: confidenceBreakdown.merchantSimilarity,
          freshness: confidenceBreakdown.freshness,
          confidenceJson: confidenceBreakdown as Prisma.InputJsonValue,
        },
      });

      await tx.experimentHistory.create({
        data: {
          storeId: input.storeId,
          experimentId: row.id,
          changeType: "shadow_simulated",
          snapshot: experiment as unknown as Prisma.InputJsonValue,
        },
      });

      const startedEvent = buildExperimentStartedEvent(experiment);
      await tx.experimentLearning.create({
        data: {
          storeId: input.storeId,
          experimentId: row.id,
          eventType: startedEvent.eventType,
          eventJson: startedEvent.eventJson as Prisma.InputJsonValue,
          memoryIds: startedEvent.memoryIds as Prisma.InputJsonValue,
          evidenceIds: startedEvent.evidenceIds as Prisma.InputJsonValue,
        },
      });

      if (winner) {
        const completedEvent = buildExperimentCompletedEvent(experiment, winner as unknown as Record<string, unknown>);
        await tx.experimentLearning.create({
          data: {
            storeId: input.storeId,
            experimentId: row.id,
            eventType: completedEvent.eventType,
            eventJson: completedEvent.eventJson as Prisma.InputJsonValue,
            memoryIds: completedEvent.memoryIds as Prisma.InputJsonValue,
            evidenceIds: completedEvent.evidenceIds as Prisma.InputJsonValue,
          },
        });
      }

      if (experiment.rankScore >= 50) {
        await tx.experimentRecommendation.upsert({
          where: {
            storeId_recommendationKey: {
              storeId: input.storeId,
              recommendationKey: `${experiment.experimentKey}:rec`,
            },
          },
          create: {
            store: { connect: { id: input.storeId } },
            experiment: { connect: { id: row.id } },
            recommendationKey: `${experiment.experimentKey}:rec`,
            title: experiment.title,
            reason: experiment.reason,
            expectedMonthlyGain: experiment.expectedRevenueImpact,
            confidence: experiment.confidence,
            businessRisk: experiment.businessRisk,
            estimatedDurationDays: experiment.estimatedDurationDays,
            active: true,
          },
          update: {
            title: experiment.title,
            reason: experiment.reason,
            expectedMonthlyGain: experiment.expectedRevenueImpact,
            confidence: experiment.confidence,
            businessRisk: experiment.businessRisk,
            estimatedDurationDays: experiment.estimatedDurationDays,
            active: true,
          },
        });
      }
    }
  });
}

function mapExperimentCreate(
  storeId: string,
  experiment: ExperimentRecord,
): Prisma.ExperimentCreateInput {
  return {
    store: { connect: { id: storeId } },
    experimentKey: experiment.experimentKey,
    experimentDomain: experiment.experimentDomain,
    templateKey: experiment.templateKey,
    title: experiment.title,
    businessProblem: experiment.businessProblem,
    proposedChange: experiment.proposedChange,
    expectedRevenueImpact: experiment.expectedRevenueImpact,
    expectedProfitImpact: experiment.expectedProfitImpact,
    confidence: experiment.confidence,
    estimatedDurationDays: experiment.estimatedDurationDays,
    merchantEffort: experiment.merchantEffort,
    businessRisk: experiment.businessRisk,
    baselineMetrics: experiment.baselineMetrics as Prisma.InputJsonValue,
    successMetrics: experiment.successMetrics as Prisma.InputJsonValue,
    evidenceIds: experiment.evidenceIds as Prisma.InputJsonValue,
    graphNodeIds: experiment.graphNodeIds as Prisma.InputJsonValue,
    memoryIds: experiment.memoryIds as Prisma.InputJsonValue,
    predictionIds: experiment.predictionIds as Prisma.InputJsonValue,
    rootCauseIds: experiment.rootCauseIds as Prisma.InputJsonValue,
    recommendationSource: experiment.recommendationSource,
    shadowSimulationJson: experiment.shadowSimulationJson as Prisma.InputJsonValue,
    status: experiment.status,
    rankScore: experiment.rankScore,
    active: true,
  };
}

function mapExperimentUpdate(experiment: ExperimentRecord): Prisma.ExperimentUpdateInput {
  return {
    title: experiment.title,
    businessProblem: experiment.businessProblem,
    proposedChange: experiment.proposedChange,
    expectedRevenueImpact: experiment.expectedRevenueImpact,
    expectedProfitImpact: experiment.expectedProfitImpact,
    confidence: experiment.confidence,
    estimatedDurationDays: experiment.estimatedDurationDays,
    merchantEffort: experiment.merchantEffort,
    businessRisk: experiment.businessRisk,
    baselineMetrics: experiment.baselineMetrics as Prisma.InputJsonValue,
    successMetrics: experiment.successMetrics as Prisma.InputJsonValue,
    evidenceIds: experiment.evidenceIds as Prisma.InputJsonValue,
    graphNodeIds: experiment.graphNodeIds as Prisma.InputJsonValue,
    memoryIds: experiment.memoryIds as Prisma.InputJsonValue,
    predictionIds: experiment.predictionIds as Prisma.InputJsonValue,
    rootCauseIds: experiment.rootCauseIds as Prisma.InputJsonValue,
    recommendationSource: experiment.recommendationSource,
    shadowSimulationJson: experiment.shadowSimulationJson as Prisma.InputJsonValue,
    status: experiment.status,
    rankScore: experiment.rankScore,
    active: true,
  };
}

async function advanceExperimentReadiness(storeId: string): Promise<void> {
  await prisma.learningReadiness.upsert({
    where: { storeId },
    create: {
      storeId,
      experimentReady: true,
      merchantMessage:
        "Experiment intelligence is ready. StorePilot found optimization opportunities with shadow-mode previews.",
      stageExplanation:
        "Deterministic experiments were generated from evidence, root causes, predictions, and business memory.",
      lastComputedAt: new Date(),
    },
    update: {
      experimentReady: true,
      merchantMessage:
        "Experiment intelligence is ready. StorePilot found optimization opportunities with shadow-mode previews.",
      stageExplanation:
        "Shadow-mode simulations completed. Approve experiments to begin measurable optimization.",
      lastComputedAt: new Date(),
    },
  });
}

export { runExperimentEngine as runExperimentPlanner };
