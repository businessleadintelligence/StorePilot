import prisma from "../db.server";
import { scanJsonPayloadForCustomerPii } from "../lib/json-pii-guard.server";
import {
  AI_AGENT_RESULT_RETENTION_DAYS,
  AI_AGENT_RUN_RETENTION_DAYS,
  AI_RESULT_CACHE_RETENTION_DAYS,
  CUSTOMER_DATA_EXPORT_RETENTION_DAYS,
  EVIDENCE_HISTORY_RETENTION_DAYS,
  EVIDENCE_OBSERVATION_RETENTION_DAYS,
  JOB_EVENT_RETENTION_DAYS,
  SYNC_JOB_RETENTION_DAYS,
  WEBHOOK_EVENT_RETENTION_DAYS,
  retentionCutoffDate,
} from "../lib/privacy-retention";
import { JobStatus } from "@prisma/client";

export type PrivacyRetentionResult = {
  expiredCustomerDataExports: number;
  deletedWebhookEvents: number;
  deletedSyncJobs: number;
  deletedJobEvents: number;
  deletedAiAgentRuns: number;
  deletedAiAgentResults: number;
  deletedEvidenceHistory: number;
  deletedEvidenceObservations: number;
  deletedAiResultCacheEntries: number;
};

export async function purgeExpiredCustomerDataExports(
  now = new Date(),
): Promise<number> {
  const result = await prisma.customerDataExport.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: now } },
        {
          expiresAt: null,
          createdAt: {
            lt: retentionCutoffDate(CUSTOMER_DATA_EXPORT_RETENTION_DAYS, now),
          },
        },
      ],
    },
  });

  return result.count;
}

export async function purgeAgedOperationalRecords(
  now = new Date(),
): Promise<PrivacyRetentionResult> {
  const webhookCutoff = retentionCutoffDate(WEBHOOK_EVENT_RETENTION_DAYS, now);
  const syncJobCutoff = retentionCutoffDate(SYNC_JOB_RETENTION_DAYS, now);
  const jobEventCutoff = retentionCutoffDate(JOB_EVENT_RETENTION_DAYS, now);
  const aiRunCutoff = retentionCutoffDate(AI_AGENT_RUN_RETENTION_DAYS, now);
  const aiResultCutoff = retentionCutoffDate(AI_AGENT_RESULT_RETENTION_DAYS, now);
  const evidenceHistoryCutoff = retentionCutoffDate(
    EVIDENCE_HISTORY_RETENTION_DAYS,
    now,
  );
  const evidenceObservationCutoff = retentionCutoffDate(
    EVIDENCE_OBSERVATION_RETENTION_DAYS,
    now,
  );
  const cacheCutoff = retentionCutoffDate(AI_RESULT_CACHE_RETENTION_DAYS, now);

  const [
    expiredCustomerDataExports,
    deletedWebhookEvents,
    deletedSyncJobs,
    deletedJobEvents,
    deletedAiAgentRuns,
    deletedAiAgentResults,
    deletedEvidenceHistory,
    deletedEvidenceObservations,
    deletedAiResultCacheEntries,
  ] = await Promise.all([
    purgeExpiredCustomerDataExports(now),
    prisma.webhookEvent.deleteMany({
      where: {
        createdAt: { lt: webhookCutoff },
        processedSuccessfully: true,
      },
    }),
    prisma.syncJob.deleteMany({
      where: {
        status: { in: [JobStatus.completed, JobStatus.dead_letter] },
        completedAt: { lt: syncJobCutoff },
      },
    }),
    prisma.jobEvent.deleteMany({
      where: {
        createdAt: { lt: jobEventCutoff },
      },
    }),
    prisma.aiAgentRun.deleteMany({
      where: {
        createdAt: { lt: aiRunCutoff },
      },
    }),
    prisma.aiAgentResult.deleteMany({
      where: {
        createdAt: { lt: aiResultCutoff },
      },
    }),
    prisma.evidenceHistory.deleteMany({
      where: {
        changedAt: { lt: evidenceHistoryCutoff },
      },
    }),
    prisma.evidenceObservation.deleteMany({
      where: {
        observedAt: { lt: evidenceObservationCutoff },
      },
    }),
    prisma.aiResultCacheEntry.deleteMany({
      where: {
        createdAt: { lt: cacheCutoff },
      },
    }),
  ]);

  return {
    expiredCustomerDataExports,
    deletedWebhookEvents: deletedWebhookEvents.count,
    deletedSyncJobs: deletedSyncJobs.count,
    deletedJobEvents: deletedJobEvents.count,
    deletedAiAgentRuns: deletedAiAgentRuns.count,
    deletedAiAgentResults: deletedAiAgentResults.count,
    deletedEvidenceHistory: deletedEvidenceHistory.count,
    deletedEvidenceObservations: deletedEvidenceObservations.count,
    deletedAiResultCacheEntries: deletedAiResultCacheEntries.count,
  };
}

type JsonScanSample = {
  table: string;
  recordId: string;
  fieldPaths: string[];
  valuePaths: string[];
};

const JSON_PII_SCAN_SAMPLE_SIZE = 25;

export async function scanPersistedJsonForCustomerPii(): Promise<{
  samplesScanned: number;
  violations: JsonScanSample[];
}> {
  const violations: JsonScanSample[] = [];
  let samplesScanned = 0;

  const evidenceRows = await prisma.evidence.findMany({
    select: { id: true, value: true },
    orderBy: { lastUpdated: "desc" },
    take: JSON_PII_SCAN_SAMPLE_SIZE,
  });

  for (const row of evidenceRows) {
    samplesScanned += 1;
    const scan = scanJsonPayloadForCustomerPii(row.value);
    if (scan.fieldPaths.length > 0 || scan.valuePaths.length > 0) {
      violations.push({
        table: "Evidence",
        recordId: row.id,
        fieldPaths: scan.fieldPaths,
        valuePaths: scan.valuePaths,
      });
    }
  }

  const aiRunRows = await prisma.aiAgentRun.findMany({
    select: { id: true, contextJson: true },
    orderBy: { createdAt: "desc" },
    take: JSON_PII_SCAN_SAMPLE_SIZE,
  });

  for (const row of aiRunRows) {
    samplesScanned += 1;
    const scan = scanJsonPayloadForCustomerPii(row.contextJson);
    if (scan.fieldPaths.length > 0 || scan.valuePaths.length > 0) {
      violations.push({
        table: "AiAgentRun",
        recordId: row.id,
        fieldPaths: scan.fieldPaths,
        valuePaths: scan.valuePaths,
      });
    }
  }

  const aiResultRows = await prisma.aiAgentResult.findMany({
    select: { id: true, resultJson: true },
    orderBy: { createdAt: "desc" },
    take: JSON_PII_SCAN_SAMPLE_SIZE,
  });

  for (const row of aiResultRows) {
    samplesScanned += 1;
    const scan = scanJsonPayloadForCustomerPii(row.resultJson);
    if (scan.fieldPaths.length > 0 || scan.valuePaths.length > 0) {
      violations.push({
        table: "AiAgentResult",
        recordId: row.id,
        fieldPaths: scan.fieldPaths,
        valuePaths: scan.valuePaths,
      });
    }
  }

  const graphNodeRows = await prisma.knowledgeGraphNode.findMany({
    select: { id: true, metadata: true },
    orderBy: { updatedAt: "desc" },
    take: JSON_PII_SCAN_SAMPLE_SIZE,
  });

  for (const row of graphNodeRows) {
    samplesScanned += 1;
    const scan = scanJsonPayloadForCustomerPii(row.metadata);
    if (scan.fieldPaths.length > 0 || scan.valuePaths.length > 0) {
      violations.push({
        table: "KnowledgeGraphNode",
        recordId: row.id,
        fieldPaths: scan.fieldPaths,
        valuePaths: scan.valuePaths,
      });
    }
  }

  return { samplesScanned, violations };
}
