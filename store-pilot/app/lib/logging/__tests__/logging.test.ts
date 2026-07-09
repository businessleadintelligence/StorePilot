import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createLogger,
  createRequestLogContext,
  createWorkerId,
  formatStructuredLogEntry,
  generateCorrelationId,
  getLogContext,
  redactLogContext,
  resolveMinimumLogLevel,
  runWithLogContext,
  shouldEmitLogLevel,
  withLogContext,
} from "../index.server";

function parseLastLog(spy: ReturnType<typeof vi.spyOn>): Record<string, unknown> {
  const line = spy.mock.calls.at(-1)?.[0];
  expect(typeof line).toBe("string");
  return JSON.parse(String(line)) as Record<string, unknown>;
}

describe("logging platform", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.LOG_LEVEL;
    process.env.NODE_ENV = "test";
  });

  it("emits single-line structured JSON logs", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const logger = createLogger({ component: "test-component" });

    logger.info("sync started", { shop: "demo.myshopify.com", operation: "product_sync" });

    const entry = parseLastLog(infoSpy);
    expect(entry.level).toBe("info");
    expect(entry.service).toBe("store-pilot");
    expect(entry.component).toBe("test-component");
    expect(entry.message).toBe("sync started");
    expect(entry.shop).toBe("demo.myshopify.com");
    expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("supports debug, warn, error, and fatal levels", () => {
    process.env.LOG_LEVEL = "debug";
    const debugSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const logger = createLogger({ component: "levels" });

    logger.debug("debug message");
    logger.warn("warn message");
    logger.error("error message");
    logger.fatal("fatal message");

    expect(parseLastLog(debugSpy).level).toBe("debug");
    expect(parseLastLog(warnSpy).level).toBe("warn");

    const errorCalls = errorSpy.mock.calls.map((call) =>
      JSON.parse(String(call[0])) as Record<string, unknown>,
    );
    expect(errorCalls.some((entry) => entry.level === "error")).toBe(true);
    expect(errorCalls.at(-1)?.level).toBe("fatal");
    expect(errorCalls.at(-1)?.message).toBe("fatal message");
  });

  it("respects LOG_LEVEL filtering", () => {
    process.env.LOG_LEVEL = "warn";
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const logger = createLogger({ component: "filter" });

    logger.info("hidden");
    logger.warn("visible");

    expect(infoSpy).not.toHaveBeenCalled();
    expect(parseLastLog(warnSpy).message).toBe("visible");
    expect(shouldEmitLogLevel("info", resolveMinimumLogLevel())).toBe(false);
    expect(shouldEmitLogLevel("warn", resolveMinimumLogLevel())).toBe(true);
  });

  it("propagates correlation IDs through async local storage", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const correlationId = generateCorrelationId();
    const workerId = createWorkerId();

    runWithLogContext({ correlationId, workerId }, () => {
      const logger = createLogger({ component: "worker" });
      logger.info("job claimed", { jobId: "job-1" });
    });

    const entry = parseLastLog(infoSpy);
    expect(entry.correlationId).toBe(correlationId);
    expect(entry.workerId).toBe(workerId);
    expect(getLogContext()).toEqual({});
  });

  it("merges child logger bindings", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const parent = createLogger({
      component: "cron-worker",
      bindings: { cronId: "cron-123" },
    });
    const child = parent.child({ workerId: "worker-456", component: "worker" });

    child.info("cycle completed");

    const entry = parseLastLog(infoSpy);
    expect(entry.component).toBe("worker");
    expect(entry.cronId).toBe("cron-123");
    expect(entry.workerId).toBe("worker-456");
  });

  it("extracts Shopify and webhook IDs from request headers", () => {
    const request = new Request("https://store-pilot.test/webhooks/products/create", {
      headers: {
        "x-shopify-request-id": "shopify-req-1",
        "x-shopify-webhook-id": "wh-123",
        "x-correlation-id": "corr-inbound",
      },
    });

    const context = createRequestLogContext(request);
    expect(context).toEqual({
      correlationId: "corr-inbound",
      shopifyRequestId: "shopify-req-1",
      webhookId: "wh-123",
    });
  });

  it("redacts sensitive keys and PII patterns", () => {
    const redacted = redactLogContext({
      shop: "demo.myshopify.com",
      accessToken: "secret-token",
      email: "customer@example.com",
      correlationId: "corr-1",
    });

    expect(redacted.accessToken).toBe("[redacted]");
    expect(redacted.email).toBe("[redacted]");
    expect(redacted.correlationId).toBe("corr-1");
    expect(redacted.shop).toBe("demo.myshopify.com");
  });

  it("formats deterministic JSON lines", () => {
    const line = formatStructuredLogEntry({
      timestamp: "2026-07-09T07:00:00.000Z",
      level: "info",
      service: "store-pilot",
      component: "webhook-event",
      message: "webhook processed",
      environment: "test",
      correlationId: "corr-1",
      webhookId: "wh-1",
    });

    expect(JSON.parse(line)).toMatchObject({
      correlationId: "corr-1",
      webhookId: "wh-1",
      message: "webhook processed",
    });
  });

  it("supports scoped context helpers", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    withLogContext({ databaseRequestId: "db-1" }, () => {
      createLogger({ component: "db" }).info("query complete");
    });

    expect(parseLastLog(infoSpy).databaseRequestId).toBe("db-1");
  });
});
