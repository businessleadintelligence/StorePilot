import { beforeEach, describe, expect, it, vi } from "vitest";

import { isAuthorizedCronRequest } from "../cron-auth.server";
import {
  runCleanupJobsCron,
  runDailyOperatingPlanCron,
  runExpiredSessionsCron,
  runKnowledgeRefreshCron,
  runLearningEngineCron,
  runMetricsAggregationCron,
  runRecommendationRefreshCron,
  runRetryQueueCron,
} from "../cron-jobs.server";
import {
  dispatchCronJob,
  getCronSchedule,
  isRegisteredCronJob,
  listAllProductionSchedules,
  listCronSchedules,
} from "../cron-scheduler.server";
import prisma from "../../db.server";
import { releaseStaleJobs, enqueueJob } from "../job.server";
import { loadOperationsSnapshot, saveOperationsSnapshot } from "../../operations/operations-persistence";

vi.mock("../job.server", () => ({
  releaseStaleJobs: vi.fn(),
  enqueueJob: vi.fn(),
}));

vi.mock("../../db.server", () => ({
  default: {
    session: {
      deleteMany: vi.fn(),
    },
    webhookEvent: {
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
    },
    storeOnboarding: {
      findMany: vi.fn(),
    },
    store: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("../../operations/operations-persistence", () => ({
  loadOperationsSnapshot: vi.fn(),
  saveOperationsSnapshot: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "test-cron-secret";
});

describe("cron-auth.server", () => {
  it("accepts x-cron-secret header", () => {
    const request = new Request("http://localhost/cron/worker", {
      headers: { "x-cron-secret": "test-cron-secret" },
    });

    expect(isAuthorizedCronRequest(request)).toEqual({ authorized: true });
  });

  it("accepts Authorization bearer token for Vercel cron", () => {
    const request = new Request("http://localhost/cron/worker", {
      headers: { authorization: "Bearer test-cron-secret" },
    });

    expect(isAuthorizedCronRequest(request)).toEqual({ authorized: true });
  });
});

describe("cron scheduler registry", () => {
  it("registers all sprint cron jobs", () => {
    const expected = [
      "retry-queue",
      "expired-sessions",
      "cleanup-jobs",
      "knowledge-refresh",
      "learning-engine",
      "daily-operating-plan",
      "metrics-aggregation",
      "recommendation-refresh",
    ];

    for (const jobId of expected) {
      expect(isRegisteredCronJob(jobId)).toBe(true);
      expect(getCronSchedule(jobId)?.productionSafe).toBe(true);
    }

    expect(listCronSchedules()).toHaveLength(expected.length);
    expect(listAllProductionSchedules()).toHaveLength(expected.length + 1);
  });
});

describe("cron job runners", () => {
  it("runs retry queue maintenance", async () => {
    vi.mocked(releaseStaleJobs).mockResolvedValue([]);

    const result = await runRetryQueueCron();
    expect(result.ok).toBe(true);
    expect(result.jobId).toBe("retry-queue");
  });

  it("runs expired session cleanup", async () => {
    vi.mocked(prisma.session.deleteMany).mockResolvedValue({ count: 3 });

    const result = await runExpiredSessionsCron();
    expect(result.details?.deletedCount).toBe(3);
  });

  it("runs cleanup jobs", async () => {
    vi.mocked(prisma.webhookEvent.deleteMany).mockResolvedValue({ count: 10 });
    vi.mocked(prisma.webhookEvent.updateMany).mockResolvedValue({ count: 2 });

    const result = await runCleanupJobsCron();
    expect(result.ok).toBe(true);
    expect(result.details?.deletedWebhookEvents).toBe(10);
  });

  it("runs learning engine for completed operations", async () => {
    vi.mocked(prisma.storeOnboarding.findMany).mockResolvedValue([
      { storeId: "store-1" },
    ] as never);
    vi.mocked(loadOperationsSnapshot).mockResolvedValue({
      operations: [
        {
          id: "op-1",
          status: "completed",
          templateId: "pricing",
          estimatedMinutes: 30,
          startedAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
          completedAt: new Date().toISOString(),
        },
      ],
      history: [],
      notifications: [],
      learning: {
        fastCategories: [],
        delayedCategories: [],
        preferredBatchSize: 3,
        prefersEvenings: false,
        ignoresWeekends: true,
        averageCompletionMinutes: 45,
      },
    } as never);

    const result = await runLearningEngineCron();
    expect(result.ok).toBe(true);
    expect(saveOperationsSnapshot).toHaveBeenCalled();
  });

  it("enqueues daily operating plan jobs", async () => {
    vi.mocked(prisma.storeOnboarding.findMany).mockResolvedValue([
      { storeId: "store-1" },
    ] as never);
    vi.mocked(enqueueJob).mockResolvedValue({ id: "job-1" } as never);

    const result = await runDailyOperatingPlanCron();
    expect(result.details?.enqueued).toBe(1);
    expect(enqueueJob).toHaveBeenCalledWith(
      expect.objectContaining({ jobType: "executive_brief_generate" }),
    );
  });

  it("enqueues knowledge refresh jobs", async () => {
    vi.mocked(prisma.storeOnboarding.findMany).mockResolvedValue([
      { storeId: "store-1" },
    ] as never);
    vi.mocked(enqueueJob).mockResolvedValue({ id: "job-2" } as never);

    const result = await runKnowledgeRefreshCron();
    expect(enqueueJob).toHaveBeenCalledWith(
      expect.objectContaining({ jobType: "connector_sync" }),
    );
    expect(result.ok).toBe(true);
  });

  it("enqueues metrics aggregation jobs", async () => {
    vi.mocked(prisma.store.findMany).mockResolvedValue([{ id: "store-1" }] as never);
    vi.mocked(enqueueJob).mockResolvedValue({ id: "job-3" } as never);

    const result = await runMetricsAggregationCron();
    expect(enqueueJob).toHaveBeenCalledWith(
      expect.objectContaining({ jobType: "metrics_recompute" }),
    );
    expect(result.ok).toBe(true);
  });

  it("enqueues recommendation refresh jobs", async () => {
    vi.mocked(prisma.storeOnboarding.findMany).mockResolvedValue([
      { storeId: "store-1" },
    ] as never);
    vi.mocked(enqueueJob).mockResolvedValue({ id: "job-4" } as never);

    const result = await runRecommendationRefreshCron();
    expect(enqueueJob).toHaveBeenCalledWith(
      expect.objectContaining({ jobType: "recommendations_generate" }),
    );
    expect(result.ok).toBe(true);
  });

  it("dispatches registered cron jobs", async () => {
    vi.mocked(releaseStaleJobs).mockResolvedValue([]);

    const dispatch = await dispatchCronJob("retry-queue");
    expect(dispatch.ok).toBe(true);
    expect(dispatch.jobId).toBe("retry-queue");
  });
});
