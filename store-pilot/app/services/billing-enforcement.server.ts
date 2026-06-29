import prisma from "../db.server";
import {
  subscriptionRowToView,
} from "./billing.server";
import { evaluateSubscriptionAccess } from "./subscription.server";

export const BILLING_LIMIT_EXCEEDED = "limit_exceeded";

export type BillingLimitMetric = "products" | "orders";

export type BillingLimitBlockedState = {
  blocked: true;
  blockedReason: typeof BILLING_LIMIT_EXCEEDED;
  blockedMessage: string;
};

export type BillingLimitCreateCheck = {
  allowed: boolean;
  used: number;
  limit: number;
  reason: string | null;
};

export type BillingTransactionClient = Pick<
  typeof prisma,
  "product" | "order" | "subscription" | "$queryRaw"
>;

function buildLimitExceededMessage(
  metric: BillingLimitMetric,
  used: number,
  limit: number,
): string {
  const label = metric === "products" ? "Product" : "Order";
  return `${label} plan limit reached (${used}/${limit})`;
}

export function toBillingLimitBlockedState(
  metric: BillingLimitMetric,
  check: BillingLimitCreateCheck,
): BillingLimitBlockedState {
  return {
    blocked: true,
    blockedReason: BILLING_LIMIT_EXCEEDED,
    blockedMessage: buildLimitExceededMessage(metric, check.used, check.limit),
  };
}

async function lockStoreForBilling(
  tx: BillingTransactionClient,
  storeId: string,
): Promise<void> {
  await tx.$queryRaw`
    SELECT id FROM stores WHERE id = ${storeId}::uuid FOR UPDATE
  `;
}

async function lockSubscriptionForBilling(
  tx: BillingTransactionClient,
  storeId: string,
): Promise<void> {
  await tx.$queryRaw`
    SELECT id FROM subscriptions WHERE store_id = ${storeId}::uuid FOR UPDATE
  `;
}

async function resolveProductLimitContextInTx(
  tx: BillingTransactionClient,
  storeId: string,
): Promise<
  | { blocked: true; reason: string }
  | { blocked: false; limit: number }
> {
  await lockStoreForBilling(tx, storeId);
  await lockSubscriptionForBilling(tx, storeId);

  const subscription = await tx.subscription.findUnique({
    where: { storeId },
    include: { plan: true },
  });
  const access = evaluateSubscriptionAccess(
    subscription ? subscriptionRowToView(subscription) : null,
  );
  if (access.accessState === "blocked") {
    return {
      blocked: true,
      reason: access.reason,
    };
  }

  const plan = subscription?.plan;
  if (!plan || !plan.active) {
    return { blocked: true, reason: "plan_missing" };
  }

  return { blocked: false, limit: plan.maxProducts };
}

async function resolveOrderLimitContextInTx(
  tx: BillingTransactionClient,
  storeId: string,
): Promise<
  | { blocked: true; reason: string }
  | { blocked: false; limit: number }
> {
  await lockStoreForBilling(tx, storeId);
  await lockSubscriptionForBilling(tx, storeId);

  const subscription = await tx.subscription.findUnique({
    where: { storeId },
    include: { plan: true },
  });
  const access = evaluateSubscriptionAccess(
    subscription ? subscriptionRowToView(subscription) : null,
  );
  if (access.accessState === "blocked") {
    return {
      blocked: true,
      reason: access.reason,
    };
  }

  const plan = subscription?.plan;
  if (!plan || !plan.active) {
    return { blocked: true, reason: "plan_missing" };
  }

  return { blocked: false, limit: plan.maxOrders };
}

export async function resolveProductLimitContext(storeId: string): Promise<
  | { blocked: true; reason: string }
  | { blocked: false; limit: number }
> {
  return prisma.$transaction(async (tx) =>
    resolveProductLimitContextInTx(tx, storeId),
  );
}

export async function resolveOrderLimitContext(storeId: string): Promise<
  | { blocked: true; reason: string }
  | { blocked: false; limit: number }
> {
  return prisma.$transaction(async (tx) =>
    resolveOrderLimitContextInTx(tx, storeId),
  );
}

export async function assertProductCreateAllowedAtomic(
  tx: BillingTransactionClient,
  storeId: string,
): Promise<BillingLimitCreateCheck> {
  const context = await resolveProductLimitContextInTx(tx, storeId);
  if (context.blocked) {
    return {
      allowed: false,
      used: 0,
      limit: 0,
      reason: context.reason,
    };
  }

  const used = await tx.product.count({ where: { storeId } });
  const allowed = used + 1 <= context.limit;

  return {
    allowed,
    used,
    limit: context.limit,
    reason: allowed ? null : BILLING_LIMIT_EXCEEDED,
  };
}

export async function assertOrderCreateAllowedAtomic(
  tx: BillingTransactionClient,
  storeId: string,
): Promise<BillingLimitCreateCheck> {
  const context = await resolveOrderLimitContextInTx(tx, storeId);
  if (context.blocked) {
    return {
      allowed: false,
      used: 0,
      limit: 0,
      reason: context.reason,
    };
  }

  const used = await tx.order.count({ where: { storeId } });
  const allowed = used + 1 <= context.limit;

  return {
    allowed,
    used,
    limit: context.limit,
    reason: allowed ? null : BILLING_LIMIT_EXCEEDED,
  };
}

export async function checkProductCreateAllowed(
  storeId: string,
): Promise<BillingLimitCreateCheck> {
  return prisma.$transaction(async (tx) =>
    assertProductCreateAllowedAtomic(tx, storeId),
  );
}

export async function checkOrderCreateAllowed(
  storeId: string,
): Promise<BillingLimitCreateCheck> {
  return prisma.$transaction(async (tx) =>
    assertOrderCreateAllowedAtomic(tx, storeId),
  );
}

export function isRootPrismaClient(db: unknown): db is typeof prisma {
  if ((db as { __transactionClient?: boolean }).__transactionClient === true) {
    return false;
  }

  return db === prisma;
}

export async function runProductCreateWithAtomicLimit<T>(
  db: BillingTransactionClient | Pick<typeof prisma, "product">,
  create: (client: BillingTransactionClient) => Promise<T>,
): Promise<T> {
  if (isRootPrismaClient(db)) {
    return prisma.$transaction(async (tx) => create(tx));
  }

  return create(db as BillingTransactionClient);
}

export async function runOrderCreateWithAtomicLimit<T>(
  db: BillingTransactionClient | Pick<typeof prisma, "order">,
  create: (client: BillingTransactionClient) => Promise<T>,
): Promise<T> {
  if (isRootPrismaClient(db)) {
    return prisma.$transaction(async (tx) => create(tx));
  }

  return create(db as BillingTransactionClient);
}
