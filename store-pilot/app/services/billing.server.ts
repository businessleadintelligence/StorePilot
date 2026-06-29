import { Prisma, type SubscriptionStatus, type UsageMetric } from "@prisma/client";

import prisma from "../db.server";

export type TryIncrementAiCreditsResult =
  | { ok: true; newValue: number }
  | { ok: false; reason: "budget_exceeded" | "usage_missing" };

const AI_CREDIT_DEBIT_MAX_RETRIES = 3;

import { getBillingTrialDays } from "../billing/plan-config";

export const DEFAULT_TRIAL_DAYS = getBillingTrialDays();
export const STARTER_PLAN_SLUG = "starter";

export const USAGE_METRICS: UsageMetric[] = [
  "products",
  "orders",
  "ai_requests",
  "reports_generated",
];

export type StorePlanView = {
  id: string;
  name: string;
  slug: string;
  monthlyPrice: number;
  annualPrice: number;
  maxProducts: number;
  maxOrders: number;
  maxTeamMembers: number;
  aiCreditsPerMonth: number;
  active: boolean;
};

export type StoreSubscriptionView = {
  id: string;
  storeId: string;
  planId: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEndsAt: Date | null;
  plan: StorePlanView;
};

export type UsageRecordView = {
  storeId: string;
  metric: UsageMetric;
  value: number;
  month: string;
};

export type CurrentMonthUsage = Record<UsageMetric, number>;

export function getSharedAiCreditsUsed(usage: CurrentMonthUsage): number {
  return Math.max(0, usage.ai_requests) + Math.max(0, usage.reports_generated);
}

function decimalToNumber(value: unknown): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, parsed);
}

export function getCurrentUsageMonth(date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function toPlanView(plan: {
  id: string;
  name: string;
  slug: string;
  monthlyPrice: unknown;
  annualPrice: unknown;
  maxProducts: number;
  maxOrders: number;
  maxTeamMembers: number;
  aiCreditsPerMonth: number;
  active: boolean;
}): StorePlanView {
  return {
    id: plan.id,
    name: plan.name,
    slug: plan.slug,
    monthlyPrice: decimalToNumber(plan.monthlyPrice),
    annualPrice: decimalToNumber(plan.annualPrice),
    maxProducts: plan.maxProducts,
    maxOrders: plan.maxOrders,
    maxTeamMembers: plan.maxTeamMembers,
    aiCreditsPerMonth: plan.aiCreditsPerMonth,
    active: plan.active,
  };
}

function toSubscriptionView(subscription: {
  id: string;
  storeId: string;
  planId: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEndsAt: Date | null;
  plan: Parameters<typeof toPlanView>[0];
}): StoreSubscriptionView {
  return {
    id: subscription.id,
    storeId: subscription.storeId,
    planId: subscription.planId,
    status: subscription.status,
    currentPeriodStart: subscription.currentPeriodStart,
    currentPeriodEnd: subscription.currentPeriodEnd,
    trialEndsAt: subscription.trialEndsAt,
    plan: toPlanView(subscription.plan),
  };
}

export function subscriptionRowToView(
  subscription: Parameters<typeof toSubscriptionView>[0],
): StoreSubscriptionView {
  return toSubscriptionView(subscription);
}

export class BootstrapSubscriptionError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(reason);
    this.name = "BootstrapSubscriptionError";
    this.reason = reason;
  }
}

function emptyCurrentMonthUsage(): CurrentMonthUsage {
  return {
    products: 0,
    orders: 0,
    ai_requests: 0,
    reports_generated: 0,
  };
}

export async function getStoreSubscription(
  storeId: string,
): Promise<StoreSubscriptionView | null> {
  if (!storeId) {
    return null;
  }

  try {
    const subscription = await prisma.subscription.findUnique({
      where: { storeId },
      include: { plan: true },
    });

    if (!subscription) {
      return null;
    }

    if (!subscription.plan) {
      return null;
    }

    return toSubscriptionView(subscription);
  } catch (error) {
    if (error instanceof BootstrapSubscriptionError) {
      throw error;
    }

    throw new BootstrapSubscriptionError(
      error instanceof Error ? error.message : "bootstrap_subscription_failed",
    );
  }
}

export async function getStorePlan(
  storeId: string,
): Promise<StorePlanView | null> {
  const subscription = await getStoreSubscription(storeId);
  return subscription?.plan ?? null;
}

export async function createTrialSubscription(
  storeId: string,
  planSlug: string = STARTER_PLAN_SLUG,
): Promise<StoreSubscriptionView | null> {
  if (!storeId) {
    return null;
  }

  try {
    const existing = await prisma.subscription.findUnique({
      where: { storeId },
      include: { plan: true },
    });

    if (existing && !isSubscriptionTerminated(existing)) {
      return toSubscriptionView(existing);
    }

    const plan = await prisma.plan.findUnique({
      where: { slug: planSlug },
    });

    if (!plan || !plan.active) {
      throw new BootstrapSubscriptionError("bootstrap_subscription_plan_unavailable");
    }

    const now = new Date();
    const trialEndsAt = addDays(now, DEFAULT_TRIAL_DAYS);

    if (existing && isSubscriptionTerminated(existing)) {
      const restarted = await prisma.subscription.update({
        where: { storeId },
        data: {
          planId: plan.id,
          status: "trialing",
          currentPeriodStart: now,
          currentPeriodEnd: trialEndsAt,
          trialEndsAt,
          endedAt: null,
        },
        include: { plan: true },
      });

      return toSubscriptionView(restarted);
    }

    const subscription = await prisma.subscription.create({
      data: {
        storeId,
        planId: plan.id,
        status: "trialing",
        currentPeriodStart: now,
        currentPeriodEnd: trialEndsAt,
        trialEndsAt,
      },
      include: { plan: true },
    });

    return toSubscriptionView(subscription);
  } catch {
    return null;
  }
}

function isSubscriptionTerminated(subscription: {
  status: SubscriptionStatus;
  endedAt: Date | null;
}): boolean {
  return subscription.status === "cancelled" || subscription.endedAt != null;
}

/**
 * Subscription lifecycle on reinstall:
 * - Active/trialing subscriptions are reused as-is (no trial extension).
 * - Terminated subscriptions after a consumed trial restart as cancelled (manual upgrade).
 * - First install receives one trial; firstTrialStartedAt is recorded on the store.
 */
export async function ensureSubscriptionForActiveStore(
  storeId: string,
  planSlug: string = STARTER_PLAN_SLUG,
): Promise<StoreSubscriptionView> {
  if (!storeId) {
    throw new BootstrapSubscriptionError("bootstrap_subscription_store_missing");
  }

  try {
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { firstTrialStartedAt: true },
    });

    const existing = await prisma.subscription.findUnique({
      where: { storeId },
      include: { plan: true },
    });

    if (existing && !isSubscriptionTerminated(existing)) {
      return toSubscriptionView(existing);
    }

    const plan = await prisma.plan.findUnique({
      where: { slug: planSlug },
    });

    if (!plan || !plan.active) {
      throw new BootstrapSubscriptionError("bootstrap_subscription_plan_unavailable");
    }

    const now = new Date();

    if (store?.firstTrialStartedAt) {
      const cancelledPeriodEnd = now;

      if (existing && isSubscriptionTerminated(existing)) {
        const restarted = await prisma.subscription.update({
          where: { storeId },
          data: {
            planId: plan.id,
            status: "cancelled",
            currentPeriodStart: now,
            currentPeriodEnd: cancelledPeriodEnd,
            trialEndsAt: null,
            endedAt: null,
          },
          include: { plan: true },
        });

        console.info("[billing-lifecycle]", {
          message: "Reinstall after consumed trial — subscription remains cancelled",
          storeId,
          operation: "subscription_reinstall_cancelled",
        });

        return toSubscriptionView(restarted);
      }

      const created = await prisma.subscription.create({
        data: {
          storeId,
          planId: plan.id,
          status: "cancelled",
          currentPeriodStart: now,
          currentPeriodEnd: cancelledPeriodEnd,
          trialEndsAt: null,
        },
        include: { plan: true },
      });

      return toSubscriptionView(created);
    }

    const trialEndsAt = addDays(now, DEFAULT_TRIAL_DAYS);

    if (existing && isSubscriptionTerminated(existing)) {
      const restarted = await prisma.subscription.update({
        where: { storeId },
        data: {
          planId: plan.id,
          status: "trialing",
          currentPeriodStart: now,
          currentPeriodEnd: trialEndsAt,
          trialEndsAt,
          endedAt: null,
        },
        include: { plan: true },
      });

      await prisma.store.update({
        where: { id: storeId },
        data: { firstTrialStartedAt: now },
      });

      console.info("[billing-lifecycle]", {
        message: "First trial started after prior subscription termination",
        storeId,
        operation: "subscription_first_trial",
      });

      return toSubscriptionView(restarted);
    }

    const subscription = await prisma.subscription.create({
      data: {
        storeId,
        planId: plan.id,
        status: "trialing",
        currentPeriodStart: now,
        currentPeriodEnd: trialEndsAt,
        trialEndsAt,
      },
      include: { plan: true },
    });

    await prisma.store.update({
      where: { id: storeId },
      data: { firstTrialStartedAt: now },
    });

    console.info("[billing-lifecycle]", {
      message: "Trial subscription created for new store",
      storeId,
      operation: "subscription_first_trial",
    });

    return toSubscriptionView(subscription);
  } catch (error) {
    if (error instanceof BootstrapSubscriptionError) {
      throw error;
    }

    throw new BootstrapSubscriptionError(
      error instanceof Error ? error.message : "bootstrap_subscription_failed",
    );
  }
}

/**
 * Uninstall lifecycle: terminate any active trial or paid period, record endedAt,
 * and preserve the subscription row for audit.
 */
export async function terminateSubscriptionOnUninstall(
  storeId: string,
): Promise<void> {
  if (!storeId) {
    return;
  }

  const existing = await prisma.subscription.findUnique({
    where: { storeId },
  });

  if (!existing || isSubscriptionTerminated(existing)) {
    return;
  }

  const now = new Date();

  await prisma.subscription.update({
    where: { storeId },
    data: {
      status: "cancelled",
      endedAt: now,
      currentPeriodEnd: now,
      trialEndsAt:
        existing.trialEndsAt && existing.trialEndsAt > now
          ? now
          : existing.trialEndsAt,
    },
  });

  console.info("[billing-lifecycle]", {
    message: "Subscription terminated on app uninstall",
    storeId,
    operation: "subscription_terminated",
    priorStatus: existing.status,
    endedAt: now.toISOString(),
  });
}

function isSerializationFailure(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034"
  );
}

async function incrementUsageRecord(
  storeId: string,
  metric: UsageMetric,
  value: number,
  month: string = getCurrentUsageMonth(),
): Promise<UsageRecordView | null> {
  if (!storeId || !Number.isFinite(value)) {
    return null;
  }

  const incrementBy = Math.max(0, Math.floor(value));

  try {
    const record = await prisma.usageRecord.upsert({
      where: {
        storeId_metric_month: {
          storeId,
          metric,
          month,
        },
      },
      create: {
        storeId,
        metric,
        month,
        value: incrementBy,
      },
      update: {
        value: {
          increment: incrementBy,
        },
      },
    });

    return {
      storeId: record.storeId,
      metric: record.metric,
      value: record.value,
      month: record.month,
    };
  } catch {
    return null;
  }
}

export async function recordUsage(
  storeId: string,
  metric: UsageMetric,
  value: number,
  month: string = getCurrentUsageMonth(),
): Promise<UsageRecordView | null> {
  if (metric === "ai_requests" || metric === "reports_generated") {
    return null;
  }

  return incrementUsageRecord(storeId, metric, value, month);
}

const SHARED_AI_CREDIT_METRICS: UsageMetric[] = [
  "ai_requests",
  "reports_generated",
];

function readLockedSharedAiUsage(
  lockedRows: Array<{ metric: UsageMetric; value: number }>,
): CurrentMonthUsage {
  const usage = emptyCurrentMonthUsage();

  for (const row of lockedRows) {
    if (SHARED_AI_CREDIT_METRICS.includes(row.metric)) {
      usage[row.metric] = Math.max(0, row.value);
    }
  }

  return usage;
}

export async function tryIncrementAiCreditsWithinLimit(
  storeId: string,
  increment: number,
  maxValue: number,
  month: string = getCurrentUsageMonth(),
  targetMetric: Extract<UsageMetric, "ai_requests" | "reports_generated"> = "ai_requests",
): Promise<TryIncrementAiCreditsResult> {
  if (!storeId || increment <= 0 || !Number.isFinite(maxValue)) {
    return { ok: false, reason: "usage_missing" };
  }

  const normalizedIncrement = Math.max(0, Math.floor(increment));
  const normalizedMax = Math.max(0, Math.floor(maxValue));

  for (let attempt = 0; attempt < AI_CREDIT_DEBIT_MAX_RETRIES; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const lockedRows = await tx.$queryRaw<
            Array<{ metric: UsageMetric; value: number }>
          >`
            SELECT metric, value
            FROM usage_records
            WHERE "storeId" = ${storeId}::uuid
              AND metric IN (
                'ai_requests'::"UsageMetric",
                'reports_generated'::"UsageMetric"
              )
              AND month = ${month}
            FOR UPDATE
          `;

          const sharedUsed = getSharedAiCreditsUsed(
            readLockedSharedAiUsage(lockedRows),
          );

          if (sharedUsed + normalizedIncrement > normalizedMax) {
            return { ok: false, reason: "budget_exceeded" as const };
          }

          const targetRow = lockedRows.find((row) => row.metric === targetMetric);

          if (!targetRow) {
            await tx.usageRecord.create({
              data: {
                storeId,
                metric: targetMetric,
                month,
                value: normalizedIncrement,
              },
            });

            return { ok: true, newValue: normalizedIncrement };
          }

          const updated = await tx.usageRecord.update({
            where: {
              storeId_metric_month: {
                storeId,
                metric: targetMetric,
                month,
              },
            },
            data: {
              value: {
                increment: normalizedIncrement,
              },
            },
          });

          return { ok: true, newValue: updated.value };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );
    } catch (error) {
      if (isSerializationFailure(error) && attempt < AI_CREDIT_DEBIT_MAX_RETRIES - 1) {
        continue;
      }

      return { ok: false, reason: "usage_missing" };
    }
  }

  return { ok: false, reason: "usage_missing" };
}

export async function getCurrentMonthUsage(
  storeId: string,
  month: string = getCurrentUsageMonth(),
): Promise<CurrentMonthUsage> {
  if (!storeId) {
    return emptyCurrentMonthUsage();
  }

  try {
    const records = await prisma.usageRecord.findMany({
      where: {
        storeId,
        month,
      },
    });

    const usage = emptyCurrentMonthUsage();

    for (const record of records) {
      usage[record.metric] = Math.max(0, record.value);
    }

    return usage;
  } catch {
    return emptyCurrentMonthUsage();
  }
}
