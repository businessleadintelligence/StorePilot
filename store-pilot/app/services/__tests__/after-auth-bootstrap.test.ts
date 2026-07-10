import { beforeEach, describe, expect, it, vi } from "vitest";
import { JobType } from "@prisma/client";

import { schedulePostAuthBootstrapJob } from "../after-auth-bootstrap.server";
import { enqueueJob } from "../job.server";

vi.mock("../job.server", () => ({
  enqueueJob: vi.fn(),
}));

describe("after-auth-bootstrap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("enqueues onboarding_bootstrap with idempotent key", async () => {
    vi.mocked(enqueueJob).mockResolvedValue({
      id: "job-1",
    } as Awaited<ReturnType<typeof enqueueJob>>);

    const jobId = await schedulePostAuthBootstrapJob("store-1");

    expect(jobId).toBe("job-1");
    expect(enqueueJob).toHaveBeenCalledWith(
      expect.objectContaining({
        storeId: "store-1",
        jobType: JobType.onboarding_bootstrap,
        idempotencyKey: "post-auth:bootstrap:store-1",
      }),
    );
  });
});
