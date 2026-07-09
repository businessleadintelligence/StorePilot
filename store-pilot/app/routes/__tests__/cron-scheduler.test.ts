import { beforeEach, describe, expect, it, vi } from "vitest";

import { dispatchCronJob, listAllProductionSchedules } from "../../services/cron-scheduler.server";
import { loader as scheduleLoader } from "../cron.schedule";
import { loader as dispatchLoader } from "../cron.dispatch.$jobId";

vi.mock("../../services/cron-scheduler.server", async () => {
  const actual = await vi.importActual<typeof import("../../services/cron-scheduler.server")>(
    "../../services/cron-scheduler.server",
  );

  return {
    ...actual,
    dispatchCronJob: vi.fn(),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "test-cron-secret";
});

describe("cron routes", () => {
  it("lists all production schedules", async () => {
    const response = await scheduleLoader({
      request: new Request("http://localhost/cron/schedule"),
    } as Parameters<typeof scheduleLoader>[0]);

    const body = await response.json();
    expect(body.count).toBe(listAllProductionSchedules().length);
    expect(body.schedules.map((schedule: { id: string }) => schedule.id)).toContain(
      "daily-operating-plan",
    );
  });

  it("rejects unauthorized cron dispatch", async () => {
    const response = await dispatchLoader({
      request: new Request("http://localhost/cron/dispatch/retry-queue"),
      params: { jobId: "retry-queue" },
    } as unknown as Parameters<typeof dispatchLoader>[0]);

    expect(response.status).toBe(401);
  });

  it("dispatches authorized cron jobs", async () => {
    vi.mocked(dispatchCronJob).mockResolvedValue({
      ok: true,
      jobId: "retry-queue",
      timestamp: "2026-07-09T07:00:00.000Z",
      result: {
        jobId: "retry-queue",
        ok: true,
        message: "ok",
      },
    });

    const response = await dispatchLoader({
      request: new Request("http://localhost/cron/dispatch/retry-queue", {
        headers: { authorization: "Bearer test-cron-secret" },
      }),
      params: { jobId: "retry-queue" },
    } as unknown as Parameters<typeof dispatchLoader>[0]);

    expect(response.status).toBe(200);
    expect(dispatchCronJob).toHaveBeenCalledWith("retry-queue");
  });
});
