import { beforeEach, describe, expect, it } from "vitest";

import { clarityHttpRequest, setClarityHttpFetchImplementation } from "../clarity/clarity-http";

describe("Clarity HTTP client", () => {
  beforeEach(() => {
    setClarityHttpFetchImplementation(null);
  });

  it("maps unauthorized responses to revoked credentials", async () => {
    setClarityHttpFetchImplementation(async () =>
      Response.json({ message: "Unauthorized" }, { status: 401 }),
    );

    await expect(
      clarityHttpRequest({
        url: "https://www.clarity.ms/export-data/api/v1/project-live-insights?numOfDays=1",
        headers: { Authorization: "Bearer invalid-token" },
      }),
    ).rejects.toMatchObject({ code: "revoked_credentials" });
  });

  it("maps request timeouts to retryable network failures", async () => {
    setClarityHttpFetchImplementation(
      () =>
        new Promise((_resolve, reject) => {
          const error = new Error("Aborted");
          error.name = "AbortError";
          reject(error);
        }),
    );

    await expect(
      clarityHttpRequest({
        url: "https://www.clarity.ms/export-data/api/v1/project-live-insights?numOfDays=1",
        headers: { Authorization: "Bearer token" },
        timeoutMs: 1,
      }),
    ).rejects.toMatchObject({ code: "network_failure", retryable: true });
  });
});
