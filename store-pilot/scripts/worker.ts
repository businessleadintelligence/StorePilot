import { runContinuousWorker } from "../app/services/worker-runtime.server";

runContinuousWorker().catch((error) => {
  console.error("[worker-entry]", {
    message: "Worker process failed",
    operation: "worker_process_failed",
    reason: error instanceof Error ? error.message : "unknown_error",
  });
  process.exitCode = 1;
});
