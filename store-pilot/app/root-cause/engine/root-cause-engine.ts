import type { Prisma } from "@prisma/client";

import prisma from "../../db.server";
import { computeSignalCorrelations } from "../correlation/signal-correlation";
import { loadRootCauseContext } from "../evidence/evidence-loader";
import { buildCausalGraphEdges } from "../causal-chain/chain-builder";
import { selectTopRootCauses } from "../ranking/cause-ranking";
import { reasonAboutRootCauses } from "../reasoning/causal-reasoner";
import { analyzeSignals } from "../signal-analysis/signal-analyzer";
import { buildBusinessTimeline } from "../timeline/timeline-builder";
import type { RootCauseEngineResult, RootCauseRecord } from "../shared/types";

export async function runRootCauseEngine(
  storeId: string,
): Promise<RootCauseEngineResult> {
  const context = await loadRootCauseContext(storeId);
  const signals = analyzeSignals(context);
  const correlations = computeSignalCorrelations(signals);
  const rawCauses = reasonAboutRootCauses({ context, signals });
  const causes = selectTopRootCauses(rawCauses);

  await persistRootCauseEngine({
    storeId,
    causes,
    correlations,
  });

  return {
    success: true,
    storeId,
    rootCauseCount: causes.length,
    correlationCount: correlations.length,
    topCause: causes[0] ?? null,
  };
}

async function persistRootCauseEngine(input: {
  storeId: string;
  causes: RootCauseRecord[];
  correlations: ReturnType<typeof computeSignalCorrelations>;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.rootCause.updateMany({
      where: { storeId: input.storeId },
      data: { active: false },
    });

    for (const cause of input.causes) {
      const row = await tx.rootCause.upsert({
        where: {
          storeId_causeKey: { storeId: input.storeId, causeKey: cause.causeKey },
        },
        create: mapRootCauseCreate(input.storeId, cause),
        update: mapRootCauseUpdate(cause),
      });

      await tx.causalChain.upsert({
        where: {
          storeId_chainKey: {
            storeId: input.storeId,
            chainKey: `${cause.causeKey}:chain`,
          },
        },
        create: {
          store: { connect: { id: input.storeId } },
          rootCause: { connect: { id: row.id } },
          chainKey: `${cause.causeKey}:chain`,
          chainJson: cause.causalChain as Prisma.InputJsonValue,
          evidenceIds: cause.evidenceIds as Prisma.InputJsonValue,
          confidence: cause.confidence,
        },
        update: {
          chainJson: cause.causalChain as Prisma.InputJsonValue,
          evidenceIds: cause.evidenceIds as Prisma.InputJsonValue,
          confidence: cause.confidence,
        },
      });

      await tx.causalTimeline.upsert({
        where: {
          storeId_timelineKey: {
            storeId: input.storeId,
            timelineKey: `${cause.causeKey}:timeline`,
          },
        },
        create: {
          store: { connect: { id: input.storeId } },
          rootCause: { connect: { id: row.id } },
          timelineKey: `${cause.causeKey}:timeline`,
          eventsJson: cause.timeline as Prisma.InputJsonValue,
          confidence: cause.confidence,
        },
        update: {
          eventsJson: cause.timeline as Prisma.InputJsonValue,
          confidence: cause.confidence,
        },
      });

      await tx.causeConfidence.create({
        data: {
          storeId: input.storeId,
          rootCauseId: row.id,
          confidenceScore: cause.confidence,
          evidenceCount: cause.evidenceIds.length,
          graphSupport: Math.min(0.95, input.causes.length > 0 ? 0.6 : 0.4),
          historicalSupport:
            typeof cause.historicalSupport.supportScore === "number"
              ? cause.historicalSupport.supportScore
              : 0.5,
          freshness: Math.min(0.95, 0.5 + cause.evidenceIds.length * 0.05),
          crossSourceAgreement: 0.7,
          confidenceJson: cause.historicalSupport as Prisma.InputJsonValue,
        },
      });

      await tx.impactAssessment.create({
        data: {
          storeId: input.storeId,
          rootCauseId: row.id,
          revenueImpact: cause.impactEstimate.revenueImpact,
          profitImpact: cause.impactEstimate.profitImpact,
          operationalImpact: cause.impactEstimate.operationalImpact,
          customerImpact: cause.impactEstimate.customerImpact,
          urgency: cause.impactEstimate.urgency,
          impactJson: cause.impactEstimate as Prisma.InputJsonValue,
        },
      });

      for (const edge of buildCausalGraphEdges(cause.causalChain)) {
        await tx.causalGraphEdge.upsert({
          where: {
            storeId_edgeKey: { storeId: input.storeId, edgeKey: `${cause.causeKey}:${edge.edgeKey}` },
          },
          create: {
            storeId: input.storeId,
            edgeKey: `${cause.causeKey}:${edge.edgeKey}`,
            fromNodeId: edge.fromNodeId,
            toNodeId: edge.toNodeId,
            relationLabel: edge.relationLabel,
            evidenceIds: edge.evidenceIds as Prisma.InputJsonValue,
            edgeJson: edge as Prisma.InputJsonValue,
            confidence: edge.confidence,
          },
          update: {
            fromNodeId: edge.fromNodeId,
            toNodeId: edge.toNodeId,
            relationLabel: edge.relationLabel,
            evidenceIds: edge.evidenceIds as Prisma.InputJsonValue,
            edgeJson: edge as Prisma.InputJsonValue,
            confidence: edge.confidence,
          },
        });
      }

      await tx.rootCauseHistory.create({
        data: {
          storeId: input.storeId,
          rootCauseId: row.id,
          changeType: "generated",
          snapshot: cause as unknown as Prisma.InputJsonValue,
        },
      });
    }

    for (const correlation of input.correlations) {
      await tx.signalCorrelation.upsert({
        where: {
          storeId_correlationKey: {
            storeId: input.storeId,
            correlationKey: correlation.correlationKey,
          },
        },
        create: {
          storeId: input.storeId,
          correlationKey: correlation.correlationKey,
          signalA: correlation.signalA,
          signalB: correlation.signalB,
          relationType: correlation.relationType,
          strength: correlation.strength,
          evidenceIds: correlation.evidenceIds as Prisma.InputJsonValue,
          correlationJson: correlation as Prisma.InputJsonValue,
        },
        update: {
          signalA: correlation.signalA,
          signalB: correlation.signalB,
          relationType: correlation.relationType,
          strength: correlation.strength,
          evidenceIds: correlation.evidenceIds as Prisma.InputJsonValue,
          correlationJson: correlation as Prisma.InputJsonValue,
          computedAt: new Date(),
        },
      });
    }
  });
}

function mapRootCauseCreate(
  storeId: string,
  cause: RootCauseRecord,
): Prisma.RootCauseCreateInput {
  return {
    store: { connect: { id: storeId } },
    causeKey: cause.causeKey,
    businessOutcome: cause.businessOutcome,
    primaryCause: cause.primaryCause,
    secondaryCauses: cause.secondaryCauses as Prisma.InputJsonValue,
    contributingFactors: cause.contributingFactors as Prisma.InputJsonValue,
    confidence: cause.confidence,
    evidenceIds: cause.evidenceIds as Prisma.InputJsonValue,
    graphNodeIds: cause.graphNodeIds as Prisma.InputJsonValue,
    businessMemoryIds: cause.businessMemoryIds as Prisma.InputJsonValue,
    quickWinIds: cause.quickWinIds as Prisma.InputJsonValue,
    merchantBaselineIds: cause.merchantBaselineIds as Prisma.InputJsonValue,
    causalChain: cause.causalChain as Prisma.InputJsonValue,
    timeline: cause.timeline as Prisma.InputJsonValue,
    historicalSupport: cause.historicalSupport as Prisma.InputJsonValue,
    impactEstimate: cause.impactEstimate as Prisma.InputJsonValue,
    severity: cause.severity,
    urgency: cause.urgency,
    rankScore: cause.rankScore,
    active: true,
    generatedAt: new Date(cause.generatedAt),
  };
}

function mapRootCauseUpdate(cause: RootCauseRecord): Prisma.RootCauseUpdateInput {
  return {
    businessOutcome: cause.businessOutcome,
    primaryCause: cause.primaryCause,
    secondaryCauses: cause.secondaryCauses as Prisma.InputJsonValue,
    contributingFactors: cause.contributingFactors as Prisma.InputJsonValue,
    confidence: cause.confidence,
    evidenceIds: cause.evidenceIds as Prisma.InputJsonValue,
    graphNodeIds: cause.graphNodeIds as Prisma.InputJsonValue,
    businessMemoryIds: cause.businessMemoryIds as Prisma.InputJsonValue,
    quickWinIds: cause.quickWinIds as Prisma.InputJsonValue,
    merchantBaselineIds: cause.merchantBaselineIds as Prisma.InputJsonValue,
    causalChain: cause.causalChain as Prisma.InputJsonValue,
    timeline: cause.timeline as Prisma.InputJsonValue,
    historicalSupport: cause.historicalSupport as Prisma.InputJsonValue,
    impactEstimate: cause.impactEstimate as Prisma.InputJsonValue,
    severity: cause.severity,
    urgency: cause.urgency,
    rankScore: cause.rankScore,
    active: true,
    generatedAt: new Date(cause.generatedAt),
  };
}

export async function getStoredBusinessTimeline(storeId: string) {
  const causes = await prisma.rootCause.findMany({
    where: { storeId, active: true },
    orderBy: { rankScore: "desc" },
  });

  const timelines = causes.map(
    (cause) => (cause.timeline as unknown as RootCauseRecord["timeline"]) ?? [],
  );

  return buildBusinessTimeline({
    storeId,
    timelines,
    generatedAt: new Date().toISOString(),
  });
}
