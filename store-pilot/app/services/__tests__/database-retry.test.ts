import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  isNonRetryablePrismaError,
  isTransientPrismaError,
  withPrismaRetry,
} from "../../../packages/database/retry";

describe("withPrismaRetry", () => {
  it("retries transient pool timeout errors up to 3 attempts", async () => {
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError("pool timeout", {
          code: "P2024",
          clientVersion: "test",
        }),
      )
      .mockRejectedValueOnce(
        new Error("Timed out fetching a new connection from the connection pool"),
      )
      .mockResolvedValueOnce("ok");

    const result = await withPrismaRetry(operation, {
      baseDelayMs: 1,
      maxDelayMs: 2,
    });

    expect(result).toBe("ok");
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it("retries serialization failures (P2034)", async () => {
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError("serialization", {
          code: "P2034",
          clientVersion: "test",
        }),
      )
      .mockResolvedValueOnce("ok");

    const result = await withPrismaRetry(operation, {
      baseDelayMs: 1,
      maxDelayMs: 2,
    });

    expect(result).toBe("ok");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("does not retry unique constraint violations", async () => {
    const error = new Prisma.PrismaClientKnownRequestError("unique", {
      code: "P2002",
      clientVersion: "test",
    });
    const operation = vi.fn<() => Promise<string>>().mockRejectedValue(error);

    await expect(
      withPrismaRetry(operation, { baseDelayMs: 1, maxDelayMs: 2 }),
    ).rejects.toBe(error);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("does not retry foreign key violations", async () => {
    const error = new Prisma.PrismaClientKnownRequestError("fk", {
      code: "P2003",
      clientVersion: "test",
    });

    expect(isNonRetryablePrismaError(error)).toBe(true);
    expect(isTransientPrismaError(error)).toBe(false);
  });

  it("does not retry validation errors", async () => {
    const error = new Prisma.PrismaClientValidationError("invalid", {
      clientVersion: "test",
    });
    const operation = vi.fn<() => Promise<string>>().mockRejectedValue(error);

    await expect(
      withPrismaRetry(operation, { baseDelayMs: 1, maxDelayMs: 2 }),
    ).rejects.toBe(error);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("invokes onRetry callback for transient failures", async () => {
    const onRetry = vi.fn();
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError("closed", {
          code: "P1017",
          clientVersion: "test",
        }),
      )
      .mockResolvedValueOnce("ok");

    await withPrismaRetry(operation, {
      baseDelayMs: 1,
      maxDelayMs: 2,
      onRetry,
    });

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe("isTransientPrismaError", () => {
  it("detects connection reset message patterns", () => {
    expect(isTransientPrismaError(new Error("read ECONNRESET"))).toBe(true);
    expect(isTransientPrismaError(new Error("deadlock detected"))).toBe(true);
  });
});
