import type {
  JobStatus,
  OnboardingPhaseStatus,
  OnboardingStatus,
} from "@prisma/client";

import prisma from "../db.server";
import type { MerchantOnboardingLoaderData } from "../lib/onboarding-display";
import {
  buildPhasePipelineView,
  computeDisplayProgressPercent,
  resolveOverallProgressLabel,
  resolvePhasePipelineState,
  type OnboardingPipelineState,
} from "./onboarding-display-state.server";

export type OnboardingStatusResponse = {
  status: OnboardingStatus;
  progressPercent: number;
  progressLabel: string | null;
  productSyncStatus: OnboardingPhaseStatus;
  inventorySyncStatus: OnboardingPhaseStatus;
  ordersSyncStatus: OnboardingPhaseStatus;
  blockedReason: string | null;
  blockedMessage: string | null;
  currentJobId: string | null;
  currentJobStatus?: JobStatus | null;
  pipelineState?: OnboardingPipelineState;
  startedAt: Date | null;
  completedAt: Date | null;
};

export type OnboardingPhaseKey = "products" | "inventory" | "orders";

export type OnboardingPhaseDisplay = {
  key: OnboardingPhaseKey;
  label: string;
  icon: "complete" | "in_progress" | "pending" | "blocked" | "failed";
};

export type OrdersBlockedDisplay = {
  heading: string;
  primary: string;
  secondary: string;
};

const PHASE_ORDER: OnboardingPhaseKey[] = ["products", "inventory", "orders"];

const PHASE_STATUS_FIELDS: Record<
  OnboardingPhaseKey,
  keyof Pick<
    OnboardingStatusResponse,
    "productSyncStatus" | "inventorySyncStatus" | "ordersSyncStatus"
  >
> = {
  products: "productSyncStatus",
  inventory: "inventorySyncStatus",
  orders: "ordersSyncStatus",
};

const PHASE_NAMES: Record<OnboardingPhaseKey, string> = {
  products: "Products",
  inventory: "Inventory",
  orders: "Orders",
};

const DEFAULT_ORDERS_BLOCKED_COPY: OrdersBlockedDisplay = {
  heading: "Orders Sync Waiting",
  primary: "StorePilot is waiting for Shopify order-access approval.",
  secondary:
    "Products and inventory are already synced. No action required.",
};

const BLOCKED_REASON_COPY: Record<string, OrdersBlockedDisplay> = {
  access_denied: DEFAULT_ORDERS_BLOCKED_COPY,
  insufficient_scope: DEFAULT_ORDERS_BLOCKED_COPY,
  protected_customer_data: {
    heading: "Orders Sync Waiting",
    primary:
      "StorePilot is waiting for Shopify order data access approval.",
    secondary:
      "Products and inventory are already synced. No action required.",
  },
};

const INTERNAL_MESSAGE_PATTERNS = [
  /graphql/i,
  /stack/i,
  /worker/i,
  /payload/i,
  /prisma/i,
  /exception/i,
  / at /,
  /\berror:\b/i,
];

export async function getOnboardingStatus(
  storeId: string,
): Promise<OnboardingStatusResponse | null> {
  const onboarding = await prisma.storeOnboarding.findUnique({
    where: { storeId },
    select: {
      status: true,
      progressPercent: true,
      progressLabel: true,
      productSyncStatus: true,
      inventorySyncStatus: true,
      ordersSyncStatus: true,
      blockedReason: true,
      blockedMessage: true,
      currentJobId: true,
      productSyncJobId: true,
      inventorySyncJobId: true,
      ordersSyncJobId: true,
      startedAt: true,
      completedAt: true,
    },
  });

  if (!onboarding) {
    return null;
  }

  const currentJob = onboarding.currentJobId
    ? await prisma.syncJob.findUnique({
        where: { id: onboarding.currentJobId },
        select: {
          id: true,
          status: true,
          jobType: true,
        },
      })
    : null;

  const activePhase = resolveActivePhase(onboarding);
  const pipelineState = resolvePhasePipelineState({
    phaseStatus: activePhase?.status ?? "not_started",
    currentJobStatus: currentJob?.status ?? null,
    isCurrentPhaseJob: Boolean(
      activePhase && onboarding.currentJobId === activePhase.jobId,
    ),
  });

  const progressPercent = computeDisplayProgressPercent({
    onboardingStatus: onboarding.status,
    productSyncStatus: onboarding.productSyncStatus,
    inventorySyncStatus: onboarding.inventorySyncStatus,
    ordersSyncStatus: onboarding.ordersSyncStatus,
  });
  const progressLabel = resolveOverallProgressLabel({
    pipelineState,
    phase: activePhase?.key ?? null,
    storedLabel: onboarding.progressLabel,
  });

  return {
    status: onboarding.status,
    progressPercent,
    progressLabel,
    productSyncStatus: onboarding.productSyncStatus,
    inventorySyncStatus: onboarding.inventorySyncStatus,
    ordersSyncStatus: onboarding.ordersSyncStatus,
    blockedReason: onboarding.blockedReason,
    blockedMessage: onboarding.blockedMessage,
    currentJobId: onboarding.currentJobId,
    currentJobStatus: currentJob?.status ?? null,
    pipelineState,
    startedAt: onboarding.startedAt,
    completedAt: onboarding.completedAt,
  };
}

function resolveActivePhase(onboarding: {
  productSyncStatus: OnboardingPhaseStatus;
  inventorySyncStatus: OnboardingPhaseStatus;
  ordersSyncStatus: OnboardingPhaseStatus;
  productSyncJobId: string | null;
  inventorySyncJobId: string | null;
  ordersSyncJobId: string | null;
}): { key: OnboardingPhaseKey; status: OnboardingPhaseStatus; jobId: string | null } | null {
  const phases: Array<{
    key: OnboardingPhaseKey;
    status: OnboardingPhaseStatus;
    jobId: string | null;
  }> = [
    {
      key: "products",
      status: onboarding.productSyncStatus,
      jobId: onboarding.productSyncJobId,
    },
    {
      key: "inventory",
      status: onboarding.inventorySyncStatus,
      jobId: onboarding.inventorySyncJobId,
    },
    {
      key: "orders",
      status: onboarding.ordersSyncStatus,
      jobId: onboarding.ordersSyncJobId,
    },
  ];

  for (const phase of phases) {
    if (
      phase.status === "queued" ||
      phase.status === "running" ||
      phase.status === "failed"
    ) {
      return phase;
    }
  }

  return null;
}

export function getPhasePipelineDisplay(
  onboarding: OnboardingStatusResponse,
  phase: OnboardingPhaseKey,
): ReturnType<typeof buildPhasePipelineView> {
  const statusField =
    phase === "products"
      ? onboarding.productSyncStatus
      : phase === "inventory"
        ? onboarding.inventorySyncStatus
        : onboarding.ordersSyncStatus;

  const pipelineState = resolvePhasePipelineState({
    phaseStatus: statusField,
    currentJobStatus: onboarding.currentJobStatus,
    isCurrentPhaseJob: true,
  });

  return buildPhasePipelineView(phase, pipelineState);
}

export function shouldShowOnboardingCard(
  onboarding: OnboardingStatusResponse | null,
): boolean {
  return onboarding !== null && onboarding.status !== "completed";
}

export function getPhaseIcon(
  status: OnboardingPhaseStatus,
): OnboardingPhaseDisplay["icon"] {
  switch (status) {
    case "completed":
    case "skipped":
      return "complete";
    case "running":
    case "queued":
      return "in_progress";
    case "blocked":
      return "blocked";
    case "failed":
      return "failed";
    default:
      return "pending";
  }
}

export function getPhaseLabel(
  phase: OnboardingPhaseKey,
  status: OnboardingPhaseStatus,
): string {
  const name = PHASE_NAMES[phase];

  switch (status) {
    case "completed":
    case "skipped":
      return `${name} synced`;
    case "queued":
      return `${name} queued`;
    case "running":
      return `${name} syncing`;
    case "blocked":
      return phase === "orders"
        ? "Waiting for Shopify order access approval"
        : `${name} blocked`;
    case "failed":
      return `${name} sync paused`;
    default:
      return `Waiting for ${name.toLowerCase()}`;
  }
}

export function getOnboardingPhaseDisplays(
  onboarding: OnboardingStatusResponse,
): OnboardingPhaseDisplay[] {
  return PHASE_ORDER.map((key) => {
    const status = onboarding[PHASE_STATUS_FIELDS[key]];

    return {
      key,
      label: getPhaseLabel(key, status),
      icon: getPhaseIcon(status),
    };
  });
}

export function getPhaseIconCharacter(
  icon: OnboardingPhaseDisplay["icon"],
): string {
  switch (icon) {
    case "complete":
      return "✓";
    case "in_progress":
      return "⏳";
    case "blocked":
    case "failed":
      return "!";
    default:
      return "○";
  }
}

export function isOrdersSyncBlocked(
  onboarding: OnboardingStatusResponse,
): boolean {
  return onboarding.ordersSyncStatus === "blocked";
}

export function isMerchantSafeMessage(message: string): boolean {
  const trimmed = message.trim();

  if (!trimmed) {
    return false;
  }

  return !INTERNAL_MESSAGE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function getOrdersBlockedDisplay(
  onboarding: OnboardingStatusResponse,
): OrdersBlockedDisplay {
  const mappedCopy =
    (onboarding.blockedReason &&
      BLOCKED_REASON_COPY[onboarding.blockedReason]) ||
    DEFAULT_ORDERS_BLOCKED_COPY;

  const primary =
    onboarding.blockedMessage &&
    isMerchantSafeMessage(onboarding.blockedMessage)
      ? onboarding.blockedMessage
      : mappedCopy.primary;

  return {
    heading: mappedCopy.heading,
    primary,
    secondary: mappedCopy.secondary,
  };
}

export function serializeOnboardingForLoader(
  onboarding: OnboardingStatusResponse | null,
): MerchantOnboardingLoaderData | null {
  if (!onboarding) {
    return null;
  }

  return {
    status: onboarding.status,
    progressPercent: onboarding.progressPercent,
    progressLabel: onboarding.progressLabel,
    pipelineState: onboarding.pipelineState,
    currentJobStatus: onboarding.currentJobStatus,
    productSyncStatus: onboarding.productSyncStatus,
    inventorySyncStatus: onboarding.inventorySyncStatus,
    ordersSyncStatus: onboarding.ordersSyncStatus,
    ordersBlockedDisplay: isOrdersSyncBlocked(onboarding)
      ? getOrdersBlockedDisplay(onboarding)
      : null,
    startedAt: onboarding.startedAt?.toISOString() ?? null,
    completedAt: onboarding.completedAt?.toISOString() ?? null,
  };
}

export function shouldShowOnboardingCardFromLoader(
  onboarding: MerchantOnboardingLoaderData | null,
): boolean {
  return onboarding !== null && onboarding.status !== "completed";
}

export type SerializedOnboardingStatus = MerchantOnboardingLoaderData;

export function deserializeOnboardingFromLoader(
  onboarding: MerchantOnboardingLoaderData | null,
): OnboardingStatusResponse | null {
  if (!onboarding) {
    return null;
  }

  return {
    status: onboarding.status,
    progressPercent: onboarding.progressPercent,
    progressLabel: onboarding.progressLabel,
    productSyncStatus: onboarding.productSyncStatus,
    inventorySyncStatus: onboarding.inventorySyncStatus,
    ordersSyncStatus: onboarding.ordersSyncStatus,
    blockedReason: onboarding.ordersBlockedDisplay ? "access_denied" : null,
    blockedMessage: onboarding.ordersBlockedDisplay?.primary ?? null,
    currentJobId: null,
    currentJobStatus: (onboarding.currentJobStatus as JobStatus | null) ?? null,
    pipelineState:
      (onboarding.pipelineState as OnboardingPipelineState | undefined) ??
      "not_started",
    startedAt: onboarding.startedAt ? new Date(onboarding.startedAt) : null,
    completedAt: onboarding.completedAt
      ? new Date(onboarding.completedAt)
      : null,
  };
}
