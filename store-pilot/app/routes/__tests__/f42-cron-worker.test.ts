import { beforeEach, describe, expect, it, vi } from "vitest";

import { runWorkerCycle } from "../../services/worker.server";
import { action, loader } from "../cron.worker";

vi.mock("../../services/worker.server", () => ({
  runWorkerCycle: vi.fn(),
}));

const CRON_SECRET = "test-cron-secret-f42";

function createRequest(input?: {
  method?: string;
  secret?: string | null;
}): Request {
  const headers = new Headers();

  if (input?.secret) {
    headers.set("x-cron-secret", input.secret);
  }

  return new Request("http://localhost/cron/worker", {
    method: input?.method ?? "POST",
    headers,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = CRON_SECRET;
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("F.4.2 Worker Cron Route", () => {
  it("1. rejects unauthorized requests with 401", async () => {
    const response = await action({
      request: createRequest({ secret: "wrong-secret" }),
    } as Parameters<typeof action>[0]);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: "Unauthorized",
      queueEnabled: true,
      reason: "invalid_cron_secret",
    });
    expect(runWorkerCycle).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      "[cron-worker]",
      expect.objectContaining({ operation: "cron_worker_unauthorized" }),
    );
  });

  it("2. rejects requests with missing secret", async () => {
    const response = await action({
      request: createRequest(),
    } as Parameters<typeof action>[0]);

    expect(response.status).toBe(401);
    expect(runWorkerCycle).not.toHaveBeenCalled();
  });

  it("3. exposes cron health on GET loader", async () => {
    const response = await loader({
      request: createRequest({ method: "GET" }),
    } as Parameters<typeof loader>[0]);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      health: {
        cronSecretConfigured: true,
        queueEnabled: true,
      },
    });
    expect(runWorkerCycle).not.toHaveBeenCalled();
  });

  it("4. runs worker cycle on authorized POST", async () => {
    vi.mocked(runWorkerCycle).mockResolvedValue({
      workerId: "cron-worker-123",
      processed: {
        jobId: "job-1",
        jobType: "bootstrap_products",
        status: "completed",
        workerId: "cron-worker-123",
      },
      processedCount: 1,
      processedJobs: [
        {
          jobId: "job-1",
          jobType: "bootstrap_products",
          status: "completed",
          workerId: "cron-worker-123",
        },
      ],
      repairedOnboardingCount: 0,
    });

    const response = await action({
      request: createRequest({ secret: CRON_SECRET }),
    } as Parameters<typeof action>[0]);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      workerId: "cron-worker-123",
      processed: {
        jobId: "job-1",
        jobType: "bootstrap_products",
        status: "completed",
        workerId: "cron-worker-123",
      },
      health: {
        queueEnabled: true,
      },
    });

    expect(runWorkerCycle).toHaveBeenCalledTimes(1);
    expect(runWorkerCycle).toHaveBeenCalledWith(
      expect.stringMatching(/^cron-worker-\d+$/),
    );
    expect(console.info).toHaveBeenCalledWith(
      "[cron-worker]",
      expect.objectContaining({ operation: "cron_worker_started" }),
    );
    expect(console.info).toHaveBeenCalledWith(
      "[cron-worker]",
      expect.objectContaining({ operation: "cron_worker_completed" }),
    );
  });

  it("5. returns 500 when worker cycle throws", async () => {
    vi.mocked(runWorkerCycle).mockRejectedValue(new Error("worker exploded"));

    const response = await action({
      request: createRequest({ secret: CRON_SECRET }),
    } as Parameters<typeof action>[0]);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: "Worker cycle failed",
      reason: "worker exploded",
    });
    expect(console.error).toHaveBeenCalledWith(
      "[cron-worker]",
      expect.objectContaining({
        operation: "cron_worker_failed",
        reason: "worker exploded",
      }),
    );
  });

  it("6. returns 503 when CRON_SECRET env is unset", async () => {
    delete process.env.CRON_SECRET;

    const response = await action({
      request: createRequest({ secret: CRON_SECRET }),
    } as Parameters<typeof action>[0]);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: "Worker queue disabled",
      queueEnabled: false,
      reason: "CRON_SECRET_missing",
    });
    expect(runWorkerCycle).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      "[cron-worker]",
      expect.objectContaining({ operation: "cron_worker_misconfigured" }),
    );
  });
});

