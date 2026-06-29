const LOG_PREFIX = "[cron-worker-health]";

export type CronWorkerHealth = {
  queueEnabled: boolean;
  cronSecretConfigured: boolean;
  reason?: string;
};

export function getCronWorkerHealth(
  env: NodeJS.ProcessEnv = process.env,
): CronWorkerHealth {
  const cronSecretConfigured = Boolean(env.CRON_SECRET?.trim());

  if (!cronSecretConfigured) {
    return {
      cronSecretConfigured: false,
      queueEnabled: false,
      reason: "CRON_SECRET_missing",
    };
  }

  return {
    cronSecretConfigured: true,
    queueEnabled: true,
  };
}

let startupHealthLogged = false;

/** Emit a founder-visible signal when the worker queue is disabled at startup. */
export function logCronWorkerStartupHealth(
  env: NodeJS.ProcessEnv = process.env,
): CronWorkerHealth {
  const health = getCronWorkerHealth(env);

  if (!startupHealthLogged) {
    startupHealthLogged = true;

    if (!health.queueEnabled) {
      console.error(LOG_PREFIX, {
        message: "Cron worker queue disabled — CRON_SECRET is not configured",
        operation: "cron_worker_misconfigured",
        ...health,
      });
    } else {
      console.info(LOG_PREFIX, {
        message: "Cron worker queue enabled",
        operation: "cron_worker_ready",
        queueEnabled: health.queueEnabled,
      });
    }
  }

  return health;
}
