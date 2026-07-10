import {
  JobStatus,
  OnboardingPhaseStatus,
  type OnboardingStatus,
} from "@prisma/client";

export type OnboardingPipelineState =
  | "queued"
  | "claimed"
  | "running"
  | "retrying"
  | "completed"
  | "failed"
  | "cancelled"
  | "blocked"
  | "not_started";

export type OnboardingPhasePipelineView = {
  pipelineState: OnboardingPipelineState;
  badge: string;
  description: string;
  nextAction: string | null;
  showRetry: boolean;
};

const PHASE_NAMES = {
  products: "Products",
  inventory: "Inventory",
  orders: "Orders",
} as const;

export type OnboardingPhaseKey = keyof typeof PHASE_NAMES;

function mapJobStatusToPipeline(
  jobStatus: JobStatus | null | undefined,
): OnboardingPipelineState | null {
  switch (jobStatus) {
    case JobStatus.queued:
      return "queued";
    case JobStatus.claimed:
      return "claimed";
    case JobStatus.running:
      return "running";
    case JobStatus.retrying:
      return "retrying";
    case JobStatus.completed:
      return "completed";
    case JobStatus.failed:
      return "failed";
    case JobStatus.cancelled:
      return "cancelled";
    case JobStatus.dead_letter:
      return "failed";
    default:
      return null;
  }
}

export function resolvePhasePipelineState(input: {
  phaseStatus: OnboardingPhaseStatus;
  currentJobStatus: JobStatus | null | undefined;
  isCurrentPhaseJob: boolean;
}): OnboardingPipelineState {
  if (
    input.phaseStatus === OnboardingPhaseStatus.completed ||
    input.phaseStatus === OnboardingPhaseStatus.skipped
  ) {
    return "completed";
  }

  if (input.phaseStatus === OnboardingPhaseStatus.blocked) {
    return "blocked";
  }

  if (input.phaseStatus === OnboardingPhaseStatus.failed) {
    return "failed";
  }

  if (input.phaseStatus === OnboardingPhaseStatus.not_started) {
    return "not_started";
  }

  if (input.isCurrentPhaseJob && input.currentJobStatus) {
    const fromJob = mapJobStatusToPipeline(input.currentJobStatus);
    if (fromJob) {
      return fromJob;
    }
  }

  if (input.phaseStatus === OnboardingPhaseStatus.queued) {
    return "queued";
  }

  if (input.phaseStatus === OnboardingPhaseStatus.running) {
    return "running";
  }

  return "not_started";
}

export function buildPhasePipelineView(
  phase: OnboardingPhaseKey,
  pipelineState: OnboardingPipelineState,
): OnboardingPhasePipelineView {
  const name = PHASE_NAMES[phase];

  switch (pipelineState) {
    case "completed":
      return {
        pipelineState,
        badge: "Completed",
        description: `${name} synced`,
        nextAction: null,
        showRetry: false,
      };
    case "queued":
      return {
        pipelineState,
        badge: "Queued",
        description: `${name} waiting for worker`,
        nextAction: "Worker will claim this job shortly",
        showRetry: false,
      };
    case "claimed":
      return {
        pipelineState,
        badge: "Claimed",
        description: `${name} claimed by worker`,
        nextAction: "Execution starting",
        showRetry: false,
      };
    case "running":
      return {
        pipelineState,
        badge: "Running",
        description: `Syncing ${name.toLowerCase()}`,
        nextAction: null,
        showRetry: false,
      };
    case "retrying":
      return {
        pipelineState,
        badge: "Retrying",
        description: `${name} sync retrying`,
        nextAction: "Automatic retry in progress",
        showRetry: false,
      };
    case "failed":
      return {
        pipelineState,
        badge: "Failed",
        description: `${name} sync paused`,
        nextAction: "Retry sync from dashboard",
        showRetry: true,
      };
    case "cancelled":
      return {
        pipelineState,
        badge: "Cancelled",
        description: `${name} sync cancelled`,
        nextAction: "Retry sync to resume onboarding",
        showRetry: true,
      };
    case "blocked":
      return {
        pipelineState,
        badge: "Blocked",
        description:
          phase === "orders"
            ? "Waiting for Shopify order access approval"
            : `${name} blocked`,
        nextAction: phase === "orders" ? "Approve order access in Shopify" : null,
        showRetry: false,
      };
    default:
      return {
        pipelineState: "not_started",
        badge: "Pending",
        description: `Waiting for ${name.toLowerCase()}`,
        nextAction: null,
        showRetry: false,
      };
  }
}

export function computeDisplayProgressPercent(input: {
  productSyncStatus: OnboardingPhaseStatus;
  inventorySyncStatus: OnboardingPhaseStatus;
  ordersSyncStatus: OnboardingPhaseStatus;
  onboardingStatus: OnboardingStatus;
}): number {
  if (input.onboardingStatus === "completed") {
    return 100;
  }

  let percent = 0;

  if (
    input.productSyncStatus === "completed" ||
    input.productSyncStatus === "blocked" ||
    input.productSyncStatus === "skipped"
  ) {
    percent = 33;
  }

  if (
    input.inventorySyncStatus === "completed" ||
    input.inventorySyncStatus === "blocked" ||
    input.inventorySyncStatus === "skipped"
  ) {
    percent = 66;
  }

  if (
    input.ordersSyncStatus === "completed" ||
    input.ordersSyncStatus === "blocked" ||
    input.ordersSyncStatus === "skipped"
  ) {
    percent = 90;
  }

  return percent;
}

export function resolveOverallProgressLabel(input: {
  pipelineState: OnboardingPipelineState;
  phase: OnboardingPhaseKey | null;
  storedLabel: string | null;
}): string {
  if (input.storedLabel && input.pipelineState === "running") {
    return input.storedLabel;
  }

  if (!input.phase) {
    return input.storedLabel ?? "Setting up your store";
  }

  const view = buildPhasePipelineView(input.phase, input.pipelineState);
  return view.description;
}
