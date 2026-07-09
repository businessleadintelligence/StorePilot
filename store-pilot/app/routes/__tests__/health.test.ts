import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getLivenessReport,
  getMonitoringReport,
  getReadinessReport,
} from "../../services/monitoring.server";
import { loader as healthLoader } from "../health";
import { loader as liveLoader } from "../health.live";
import { loader as monitorLoader } from "../health.monitor";
import { loader as readyLoader } from "../health.ready";

vi.mock("../../services/monitoring.server", () => ({
  getLivenessReport: vi.fn(),
  getReadinessReport: vi.fn(),
  getMonitoringReport: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("monitoring routes", () => {
  it("GET /health returns liveness by default", async () => {
    vi.mocked(getLivenessReport).mockReturnValue({
      ok: true,
      service: "store-pilot",
      mode: "liveness",
      timestamp: "2026-07-09T07:00:00.000Z",
    });

    const response = await healthLoader({
      request: new Request("http://localhost/health"),
    } as Parameters<typeof healthLoader>[0]);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ mode: "liveness" });
    expect(getMonitoringReport).not.toHaveBeenCalled();
  });

  it("GET /health?ready=1 returns readiness", async () => {
    vi.mocked(getReadinessReport).mockResolvedValue({
      ok: false,
      service: "store-pilot",
      mode: "readiness",
      timestamp: "2026-07-09T07:00:00.000Z",
      checks: [{ id: "cron_secret", ok: false }],
    });

    const response = await healthLoader({
      request: new Request("http://localhost/health?ready=1"),
    } as Parameters<typeof healthLoader>[0]);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ mode: "readiness", ok: false });
  });

  it("GET /health?monitor=1 returns full monitoring report", async () => {
    vi.mocked(getMonitoringReport).mockResolvedValue({
      ok: true,
      service: "store-pilot",
      mode: "monitor",
      timestamp: "2026-07-09T07:00:00.000Z",
      checks: [{ id: "database", status: "healthy", ok: true }],
    });

    const response = await healthLoader({
      request: new Request("http://localhost/health?monitor=1"),
    } as Parameters<typeof healthLoader>[0]);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ mode: "monitor" });
  });

  it("GET /health/live returns liveness", async () => {
    vi.mocked(getLivenessReport).mockReturnValue({
      ok: true,
      service: "store-pilot",
      mode: "liveness",
      timestamp: "2026-07-09T07:00:00.000Z",
    });

    const response = await liveLoader();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ mode: "liveness" });
  });

  it("GET /health/ready returns readiness", async () => {
    vi.mocked(getReadinessReport).mockResolvedValue({
      ok: true,
      service: "store-pilot",
      mode: "readiness",
      timestamp: "2026-07-09T07:00:00.000Z",
      checks: [],
    });

    const response = await readyLoader();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ mode: "readiness" });
  });

  it("GET /health/monitor returns subsystem health", async () => {
    vi.mocked(getMonitoringReport).mockResolvedValue({
      ok: false,
      service: "store-pilot",
      mode: "monitor",
      timestamp: "2026-07-09T07:00:00.000Z",
      checks: [{ id: "database", status: "unhealthy", ok: false }],
    });

    const response = await monitorLoader();
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ mode: "monitor", ok: false });
  });
});
