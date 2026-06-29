import { JobStatus, OnboardingStatus } from "@prisma/client";

import prisma from "../db.server";
import { findExpiredRunningJobs } from "./job.server";
import { findStuckOnboarding } from "./onboarding.server";
import {
  getStartupReadiness,
  type StartupReadiness,
} from "./startup-readiness.server";

export type FounderHealthIndicator = "green" | "yellow" | "red";

export type FounderStoresSnapshot = {
  totalStores: number;
  activeStores: number;
  inactiveStores: number;
};

export type FounderOnboardingSnapshot = {
  completed: number;
  running: number;
  failed: number;
  blocked: number;
  notStarted: number;
};

export type FounderJobsSnapshot = {
  queued: number;
  running: number;
  completed: number;
  failed: number;
  deadLetter: number;
};

export type FounderWebhooksSnapshot = {
  processed: number;
  failed: number;
  pending: number;
};

export type FounderWorkersSnapshot = {
  staleJobs: number;
  stuckOnboarding: number;
  expiredLocks: number;
};

export type FounderOperationsSnapshot = {
  stores: FounderStoresSnapshot;
  onboarding: FounderOnboardingSnapshot;
  jobs: FounderJobsSnapshot;
  webhooks: FounderWebhooksSnapshot;
  workers: FounderWorkersSnapshot;
  startupReadiness: StartupReadiness;
};

const EMPTY_SNAPSHOT: FounderOperationsSnapshot = {
  stores: {
    totalStores: 0,
    activeStores: 0,
    inactiveStores: 0,
  },
  onboarding: {
    completed: 0,
    running: 0,
    failed: 0,
    blocked: 0,
    notStarted: 0,
  },
  jobs: {
    queued: 0,
    running: 0,
    completed: 0,
    failed: 0,
    deadLetter: 0,
  },
  webhooks: {
    processed: 0,
    failed: 0,
    pending: 0,
  },
  workers: {
    staleJobs: 0,
    stuckOnboarding: 0,
    expiredLocks: 0,
  },
  startupReadiness: {
    ready: false,
    checks: [],
  },
};

export function getJobsHealthIndicator(
  failedJobs: number,
): FounderHealthIndicator {
  if (failedJobs <= 0) {
    return "green";
  }

  if (failedJobs <= 5) {
    return "yellow";
  }

  return "red";
}

export function getOnboardingHealthIndicator(
  stuckOnboarding: number,
): FounderHealthIndicator {
  if (stuckOnboarding <= 0) {
    return "green";
  }

  return "red";
}

export function getHealthIndicatorTone(
  indicator: FounderHealthIndicator,
): "success" | "warning" | "critical" | undefined {
  switch (indicator) {
    case "green":
      return "success";
    case "yellow":
      return "warning";
    case "red":
      return "critical";
    default:
      return undefined;
  }
}

export function serializeFounderOperationsSnapshot(
  snapshot: FounderOperationsSnapshot,
): FounderOperationsSnapshot {
  return {
    stores: { ...snapshot.stores },
    onboarding: { ...snapshot.onboarding },
    jobs: { ...snapshot.jobs },
    webhooks: { ...snapshot.webhooks },
    workers: { ...snapshot.workers },
    startupReadiness: {
      ready: snapshot.startupReadiness.ready,
      checks: snapshot.startupReadiness.checks.map((check) => ({ ...check })),
    },
  };
}

async function countStoresSnapshot(): Promise<FounderStoresSnapshot> {
  const [totalStores, activeStores, inactiveStores] = await Promise.all([
    prisma.store.count(),
    prisma.store.count({ where: { active: true } }),
    prisma.store.count({ where: { active: false } }),
  ]);

  return {
    totalStores,
    activeStores,
    inactiveStores,
  };
}

async function countOnboardingSnapshot(): Promise<FounderOnboardingSnapshot> {
  const [completed, running, failed, blocked, notStarted] = await Promise.all([
    prisma.storeOnboarding.count({
      where: { status: OnboardingStatus.completed },
    }),
    prisma.storeOnboarding.count({
      where: {
        status: {
          in: [OnboardingStatus.running, OnboardingStatus.queued],
        },
      },
    }),
    prisma.storeOnboarding.count({
      where: { status: OnboardingStatus.failed },
    }),
    prisma.storeOnboarding.count({
      where: {
        OR: [
          { ordersSyncStatus: "blocked" },
          { productSyncStatus: "blocked" },
          { inventorySyncStatus: "blocked" },
          { blockedReason: { not: null } },
        ],
      },
    }),
    prisma.storeOnboarding.count({
      where: { status: OnboardingStatus.not_started },
    }),
  ]);

  return {
    completed,
    running,
    failed,
    blocked,
    notStarted,
  };
}

async function countJobsSnapshot(): Promise<FounderJobsSnapshot> {
  const [queued, running, completed, failed, deadLetter] = await Promise.all([
    prisma.syncJob.count({
      where: {
        status: {
          in: [JobStatus.queued, JobStatus.retrying],
        },
      },
    }),
    prisma.syncJob.count({
      where: { status: JobStatus.running },
    }),
    prisma.syncJob.count({
      where: { status: JobStatus.completed },
    }),
    prisma.syncJob.count({
      where: { status: JobStatus.failed },
    }),
    prisma.syncJob.count({
      where: { status: JobStatus.dead_letter },
    }),
  ]);

  return {
    queued,
    running,
    completed,
    failed,
    deadLetter,
  };
}

async function countWebhooksSnapshot(): Promise<FounderWebhooksSnapshot> {
  const [processed, pending] = await Promise.all([
    prisma.webhookEvent.count({
      where: { processedSuccessfully: true },
    }),
    prisma.webhookEvent.count({
      where: { processedSuccessfully: false },
    }),
  ]);

  return {
    processed,
    pending,
    failed: pending,
  };
}

async function countWorkersSnapshot(): Promise<FounderWorkersSnapshot> {
  const [expiredJobs, stuckOnboarding] = await Promise.all([
    findExpiredRunningJobs(),
    findStuckOnboarding(),
  ]);
  const expiredLocks = expiredJobs.length;

  return {
    staleJobs: expiredLocks,
    stuckOnboarding: stuckOnboarding.length,
    expiredLocks,
  };
}

export async function getFounderOperationsSnapshot(): Promise<FounderOperationsSnapshot> {
  try {
    const [stores, onboarding, jobs, webhooks, workers, startupReadiness] =
      await Promise.all([
      countStoresSnapshot(),
      countOnboardingSnapshot(),
      countJobsSnapshot(),
      countWebhooksSnapshot(),
      countWorkersSnapshot(),
      getStartupReadiness(),
    ]);

    return serializeFounderOperationsSnapshot({
      stores,
      onboarding,
      jobs,
      webhooks,
      workers,
      startupReadiness,
    });
  } catch {
    return { ...EMPTY_SNAPSHOT };
  }
}
