import { JobPriority, JobType } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { STORE_ID, testHarness } from "./helpers/fixtures";
import { scheduleIntelligencePipelineJob } from "../../intelligence/scheduler/pipeline-chain.server";

beforeEach(() => {
  const harness = testHarness();
  harness.resetDbState();
  vi.clearAllMocks();
});

describe("Epic 2.4 intelligence pipeline chain scheduler", () => {
  it("1. schedules root cause jobs without importing domain schedulers", async () => {
    const jobId = await scheduleIntelligencePipelineJob({
      storeId: STORE_ID,
      stage: "root_cause_generate",
      contextSnapshotId: "ctx-1",
      idempotencyKey: "pipeline:root-cause:test",
    });

    expect(jobId).toBeTruthy();
    const harness = testHarness();
    const job = [...harness.dbState.syncJobs.values()].find(
      (entry) => entry.idempotencyKey === "pipeline:root-cause:test",
    );
    expect(job?.jobType).toBe(JobType.root_cause_generate);
    expect(job?.priority).toBe(JobPriority.high);
  });

  it("2. schedules executive COO jobs for experiment pipeline continuation", async () => {
    await scheduleIntelligencePipelineJob({
      storeId: STORE_ID,
      stage: "executive_coo_generate",
      contextSnapshotId: "ctx-exp",
      idempotencyKey: "pipeline:executive-coo:test",
    });

    const harness = testHarness();
    const job = [...harness.dbState.syncJobs.values()].find(
      (entry) => entry.idempotencyKey === "pipeline:executive-coo:test",
    );
    expect(job?.jobType).toBe(JobType.executive_coo_generate);
    expect(job?.payload).toEqual({ contextSnapshotId: "ctx-exp" });
  });
});
