import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { isAuthorizedCronRequest } from "../services/cron-auth.server";
import {
  getCronWorkerHealth,
  logCronWorkerStartupHealth,
} from "../services/cron-worker.server";
import { runWorkerCycle } from "../services/worker.server";

const LOG_PREFIX = "[cron-worker]";

type LogLevel = "info" | "warn" | "error";

type CronWorkerLogContext = {
  workerId?: string;
  operation:
    | "cron_worker_started"
    | "cron_worker_completed"
    | "cron_worker_unauthorized"
    | "cron_worker_misconfigured"
    | "cron_worker_failed";
  reason?: string;
  status?: string;
};

function logCronWorker(
  level: LogLevel,
  message: string,
  context: CronWorkerLogContext,
): void {
  const payload = { message, ...context };

  if (level === "error") {
    console.error(LOG_PREFIX, payload);
    return;
  }

  if (level === "warn") {
    console.warn(LOG_PREFIX, payload);
    return;
  }

  console.info(LOG_PREFIX, payload);
}

function ensureCronWorkerStartupHealthLogged(): void {
  logCronWorkerStartupHealth();
}

function methodNotAllowedResponse(): Response {
  return new Response("Method Not Allowed", { status: 405 });
}


function unauthorizedResponse(reason: string): Response {
  const health = getCronWorkerHealth();

  logCronWorker(
    health.cronSecretConfigured ? "warn" : "error",
    health.cronSecretConfigured
      ? "Unauthorized cron worker request"
      : "Cron worker queue disabled — CRON_SECRET is not configured",
    {
      operation: health.cronSecretConfigured
        ? "cron_worker_unauthorized"
        : "cron_worker_misconfigured",
      reason,
    },
  );

  return Response.json(
    {
      success: false,
      error: health.cronSecretConfigured
        ? "Unauthorized"
        : "Worker queue disabled",
      queueEnabled: health.queueEnabled,
      reason,
    },
    { status: health.cronSecretConfigured ? 401 : 503 },
  );
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  ensureCronWorkerStartupHealthLogged();

  if (request.method !== "GET" && request.method !== "POST") {
    return methodNotAllowedResponse();
  }

  const authorization = isAuthorizedCronRequest(request);
  if (authorization.authorized) {
    const workerId = `cron-worker-${Date.now()}`;

    logCronWorker("info", "Cron worker cycle started", {
      workerId,
      operation: "cron_worker_started",
    });

    try {
      const result = await runWorkerCycle(workerId);

      logCronWorker("info", "Cron worker cycle completed", {
        workerId,
        operation: "cron_worker_completed",
        status: result.processed?.status,
      });

      return Response.json({
        success: true,
        workerId: result.workerId,
        processed: result.processed,
        health: getCronWorkerHealth(),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown_error";

      logCronWorker("error", "Cron worker cycle failed", {
        workerId,
        operation: "cron_worker_failed",
        reason,
      });

      return Response.json(
        { success: false, error: "Worker cycle failed", reason },
        { status: 500 },
      );
    }
  }

  const health = getCronWorkerHealth();

  return Response.json({
    success: health.queueEnabled,
    health,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return methodNotAllowedResponse();
  }

  const authorization = isAuthorizedCronRequest(request);
  if (!authorization.authorized) {
    return unauthorizedResponse(authorization.reason ?? "unauthorized");
  }

  const workerId = `cron-worker-${Date.now()}`;

  logCronWorker("info", "Cron worker cycle started", {
    workerId,
    operation: "cron_worker_started",
  });

  try {
    const result = await runWorkerCycle(workerId);

    logCronWorker("info", "Cron worker cycle completed", {
      workerId,
      operation: "cron_worker_completed",
      status: result.processed?.status,
    });

    return Response.json({
      success: true,
      workerId: result.workerId,
      processed: result.processed,
      health: getCronWorkerHealth(),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown_error";

    logCronWorker("error", "Cron worker cycle failed", {
      workerId,
      operation: "cron_worker_failed",
      reason,
    });

    return Response.json(
      { success: false, error: "Worker cycle failed", reason },
      { status: 500 },
    );
  }
};
