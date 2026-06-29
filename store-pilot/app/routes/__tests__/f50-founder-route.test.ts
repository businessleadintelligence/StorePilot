import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loader } from "../internal.founder";
import { getFounderOperationsSnapshot } from "../../services/founder-ops.server";

vi.mock("../../services/founder-ops.server", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../services/founder-ops.server")>();
  return {
    ...actual,
    getFounderOperationsSnapshot: vi.fn(),
  };
});

function createRequest(): Request {
  return new Request("http://localhost/internal/founder");
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "development");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("F.5.0 Founder Operations Route", () => {
  it("1. returns 404 in production", async () => {
    vi.stubEnv("NODE_ENV", "production");

    await expect(
      loader({
        request: createRequest(),
      } as Parameters<typeof loader>[0]),
    ).rejects.toEqual(new Response(null, { status: 404, statusText: "Not Found" }));

    expect(getFounderOperationsSnapshot).not.toHaveBeenCalled();
  });

  it("2. loads founder snapshot in development", async () => {
    vi.mocked(getFounderOperationsSnapshot).mockResolvedValue({
      stores: { totalStores: 1, activeStores: 1, inactiveStores: 0 },
      onboarding: {
        completed: 0,
        running: 1,
        failed: 0,
        blocked: 0,
        notStarted: 0,
      },
      jobs: {
        queued: 1,
        running: 0,
        completed: 2,
        failed: 0,
        deadLetter: 0,
      },
      webhooks: { processed: 3, failed: 0, pending: 1 },
      workers: { staleJobs: 0, stuckOnboarding: 0, expiredLocks: 0 },
      startupReadiness: {
        ready: true,
        checks: [{ id: "cron_secret", ok: true }],
      },
    });

    const data = await loader({
      request: createRequest(),
    } as Parameters<typeof loader>[0]);

    expect(getFounderOperationsSnapshot).toHaveBeenCalledTimes(1);
    expect(data.snapshot.jobs.completed).toBe(2);
  });
});
