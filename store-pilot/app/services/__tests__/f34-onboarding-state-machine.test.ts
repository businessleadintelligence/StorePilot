import { beforeEach, describe, expect, it, vi } from "vitest";

import { STORE_ID, testHarness } from "./helpers/fixtures";
import {
  advanceOnboarding,
  getOrCreateStoreOnboarding,
  getStoreOnboarding,
  markPhaseCompleted,
  markPhaseFailed,
  markPhaseStarted,
} from "../onboarding.server";

beforeEach(() => {
  const harness = testHarness();
  harness.resetDbState();
  vi.clearAllMocks();
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

function productsIdempotencyKey(runId: string): string {
  return `onboarding:${STORE_ID}:products:${runId}`;
}

describe("F.3.4 Onboarding State Machine", () => {
  it("1. getOrCreateStoreOnboarding creates initial pending onboarding row", async () => {
    const summary = await getOrCreateStoreOnboarding(STORE_ID);
    const harness = testHarness();

    expect(summary.status).toBe("not_started");
    expect(summary.productSyncStatus).toBe("not_started");
    expect(summary.inventorySyncStatus).toBe("not_started");
    expect(summary.ordersSyncStatus).toBe("not_started");
    expect(harness.getOnboarding(STORE_ID)).toBeDefined();
  });

  it("2. advanceOnboarding enqueues products phase job and links onboarding fields", async () => {
    await getOrCreateStoreOnboarding(STORE_ID);

    const result = await advanceOnboarding({ storeId: STORE_ID });
    const harness = testHarness();
    const onboarding = harness.getOnboarding(STORE_ID);
    const runId = onboarding?.onboardingRunId ?? "";
    const productsJob = harness.dbState.syncJobsByIdempotency.get(
      productsIdempotencyKey(runId),
    );

    expect(result.action).toBe("enqueued");
    expect(result.phase).toBe("PRODUCTS");
    expect(result.jobId).toBeDefined();
    expect(onboarding?.productSyncStatus).toBe("queued");
    expect(onboarding?.progressPercent).toBe(0);
    expect(onboarding?.progressLabel).toBe("Products queued");
    expect(onboarding?.productSyncJobId).toBe(result.jobId);
    expect(onboarding?.currentJobId).toBe(result.jobId);
    expect(onboarding?.status).toBe("running");
    expect(productsJob).toBe(result.jobId);
    expect(harness.dbState.syncJobs.size).toBe(1);
  });

  it("3. advanceOnboarding enqueues inventory after products complete", async () => {
    await getOrCreateStoreOnboarding(STORE_ID);
    await advanceOnboarding({ storeId: STORE_ID });
    await markPhaseCompleted(STORE_ID, "PRODUCTS");

    const harness = testHarness();
    const onboarding = harness.getOnboarding(STORE_ID);

    expect(onboarding?.productSyncStatus).toBe("completed");
    expect(onboarding?.inventorySyncStatus).toBe("queued");
    expect(onboarding?.progressPercent).toBe(33);
    expect(onboarding?.inventorySyncJobId).toBe(onboarding?.currentJobId);
    expect(harness.dbState.syncJobs.size).toBe(2);
    expect(
      harness.dbState.syncJobsByIdempotency.has(
        `onboarding:${STORE_ID}:inventory:${onboarding?.onboardingRunId}`,
      ),
    ).toBe(true);
  });

  it("4. advanceOnboarding enqueues orders after inventory complete", async () => {
    await getOrCreateStoreOnboarding(STORE_ID);
    await advanceOnboarding({ storeId: STORE_ID });
    await markPhaseCompleted(STORE_ID, "PRODUCTS");
    await markPhaseCompleted(STORE_ID, "INVENTORY");

    const harness = testHarness();
    const onboarding = harness.getOnboarding(STORE_ID);

    expect(onboarding?.inventorySyncStatus).toBe("completed");
    expect(onboarding?.ordersSyncStatus).toBe("queued");
    expect(onboarding?.progressPercent).toBe(66);
    expect(onboarding?.ordersSyncJobId).toBe(onboarding?.currentJobId);
    expect(harness.dbState.syncJobs.size).toBe(3);
  });

  it("5. advanceOnboarding completes onboarding when all phases are done", async () => {
    await getOrCreateStoreOnboarding(STORE_ID);
    await advanceOnboarding({ storeId: STORE_ID });
    await markPhaseCompleted(STORE_ID, "PRODUCTS");
    await markPhaseCompleted(STORE_ID, "INVENTORY");
    const result = await markPhaseCompleted(STORE_ID, "ORDERS");

    const harness = testHarness();
    const onboarding = harness.getOnboarding(STORE_ID);

    expect(result.action).toBe("completed");
    expect(result.phase).toBe("COMPLETE");
    expect(onboarding?.status).toBe("completed");
    expect(onboarding?.completedAt).toBeInstanceOf(Date);
    expect(onboarding?.currentJobId).toBeNull();
    expect(onboarding?.progressPercent).toBe(100);
  });

  it("6. repeated advanceOnboarding calls do not create duplicate jobs", async () => {
    await getOrCreateStoreOnboarding(STORE_ID);

    const first = await advanceOnboarding({ storeId: STORE_ID });
    const second = await advanceOnboarding({ storeId: STORE_ID });
    const harness = testHarness();

    expect(first.action).toBe("enqueued");
    expect(second.action).toBe("noop");
    expect(harness.dbState.syncJobs.size).toBe(1);
    expect(first.jobId).toBe(second.onboarding.productSyncJobId);
  });

  it("7. markPhaseFailed marks phase and onboarding as failed", async () => {
    await getOrCreateStoreOnboarding(STORE_ID);
    await advanceOnboarding({ storeId: STORE_ID });

    const result = await markPhaseFailed(
      STORE_ID,
      "PRODUCTS",
      "shopify_timeout",
    );
    const harness = testHarness();
    const onboarding = harness.getOnboarding(STORE_ID);

    expect(result.action).toBe("failed");
    expect(onboarding?.productSyncStatus).toBe("failed");
    expect(onboarding?.status).toBe("failed");
    expect(onboarding?.failedAt).toBeInstanceOf(Date);
    expect(onboarding?.lastErrorMessage).toBe("shopify_timeout");
    expect(onboarding?.currentJobId).toBeNull();
  });

  it("8. markPhaseCompleted automatically progresses to the next phase", async () => {
    await getOrCreateStoreOnboarding(STORE_ID);
    await advanceOnboarding({ storeId: STORE_ID });

    const result = await markPhaseCompleted(STORE_ID, "PRODUCTS");
    const harness = testHarness();

    expect(result.action).toBe("enqueued");
    expect(result.phase).toBe("INVENTORY");
    expect(harness.dbState.syncJobs.size).toBe(2);
  });

  it("9. getStoreOnboarding returns null before onboarding exists", async () => {
    expect(await getStoreOnboarding(STORE_ID)).toBeNull();
  });

  it("10. markPhaseStarted marks phase as running when currentJobId exists", async () => {
    await getOrCreateStoreOnboarding(STORE_ID);
    await advanceOnboarding({ storeId: STORE_ID });

    const result = await markPhaseStarted(STORE_ID, "PRODUCTS");
    const harness = testHarness();

    expect(result.action).toBe("started");
    expect(result.phase).toBe("PRODUCTS");
    expect(harness.getOnboarding(STORE_ID)?.productSyncStatus).toBe("running");
    expect(harness.getOnboarding(STORE_ID)?.progressPercent).toBe(0);
    expect(harness.getOnboarding(STORE_ID)?.currentJobId).toBeTruthy();
  });
});
