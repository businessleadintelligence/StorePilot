import { readdirSync } from "node:fs";
import { join } from "node:path";
import { Prisma } from "@prisma/client";
import { vi } from "vitest";
import type {
  JobPriority,
  JobStatus,
  JobType,
  OnboardingPhaseStatus,
  OnboardingStatus,
  ProductStatus,
  SubscriptionStatus,
  UsageMetric,
} from "@prisma/client";

process.env.TOKEN_ENCRYPTION_KEY =
  process.env.TOKEN_ENCRYPTION_KEY ?? "test-token-encryption-key";
process.env.CRON_SECRET = process.env.CRON_SECRET ?? "test-cron-secret";
process.env.SCOPES =
  process.env.SCOPES ?? "read_products,read_inventory,write_products,read_orders";
process.env.SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET ?? "test-shopify-api-secret";

function expectedMigrationRows(): Array<{ migration_name: string }> {
  return readdirSync(join(process.cwd(), "prisma", "migrations"))
    .filter((name) => /^\d+_/.test(name))
    .map((migration_name) => ({ migration_name }));
}

export type MockProduct = {
  id: string;
  storeId: string;
  shopifyProductId: string;
  shopifyVariantId: string;
  shopifyInventoryItemId: string | null;
  title: string;
  sku: string | null;
  status: ProductStatus;
  price: unknown;
  inventoryQuantity: number | null;
  inventoryTracked: boolean;
  shopifyProductUpdatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type MockWebhookEvent = {
  id: string;
  storeId: string;
  shopifyWebhookId: string;
  shop: string;
  topic: string;
  processedSuccessfully: boolean;
  processedAt: Date | null;
  processingOwner?: string | null;
  processingExpiresAt?: Date | null;
  createdAt: Date;
};

export type MockSyncJob = {
  id: string;
  storeId: string;
  jobType: JobType;
  status: JobStatus;
  priority: JobPriority;
  payload: unknown;
  cursorJson: unknown;
  progressJson: unknown;
  attempts: number;
  maxAttempts: number;
  availableAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  failedAt: Date | null;
  deadLetterAt: Date | null;
  cancelledAt: Date | null;
  errorCode: string | null;
  errorMessage: string | null;
  idempotencyKey: string;
  lockedBy: string | null;
  lockedAt: Date | null;
  lockExpiresAt: Date | null;
  heartbeatAt: Date | null;
  durationMs: number | null;
  workerGeneration: number;
  createdAt: Date;
  updatedAt: Date;
};

export type MockJobEvent = {
  id: string;
  storeId: string;
  jobId: string;
  eventType: string;
  fromStatus: JobStatus | null;
  toStatus: JobStatus | null;
  attemptNumber: number | null;
  message: string | null;
  metadataJson: unknown;
  actorType: string;
  actorId: string | null;
  createdAt: Date;
};

export type MockStoreOnboarding = {
  id: string;
  storeId: string;
  status: OnboardingStatus;
  onboardingRunId: string;
  currentJobId: string | null;
  productSyncStatus: OnboardingPhaseStatus;
  productSyncJobId: string | null;
  productSyncCompletedAt: Date | null;
  inventorySyncStatus: OnboardingPhaseStatus;
  inventorySyncJobId: string | null;
  inventorySyncCompletedAt: Date | null;
  ordersSyncStatus: OnboardingPhaseStatus;
  ordersSyncJobId: string | null;
  ordersSyncCompletedAt: Date | null;
  blockedReason: string | null;
  blockedMessage: string | null;
  degradedReason: string | null;
  progressPercent: number;
  progressLabel: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  attempts: number;
  maxAttempts: number;
  startedAt: Date | null;
  coreCompletedAt: Date | null;
  completedAt: Date | null;
  fullCompletedAt: Date | null;
  failedAt: Date | null;
  googleAnalyticsSkippedAt?: Date | null;
  ownershipRepairPending?: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type MockPlan = {
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
  createdAt: Date;
  updatedAt: Date;
};

export type MockSubscription = {
  id: string;
  storeId: string;
  planId: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEndsAt: Date | null;
  endedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type MockUsageRecord = {
  id: string;
  storeId: string;
  metric: UsageMetric;
  value: number;
  month: string;
  createdAt: Date;
  updatedAt: Date;
};

export type MockCustomerDataExport = {
  id: string;
  storeId: string;
  shopifyCustomerId: string;
  dataRequestId: string | null;
  shopifyWebhookId: string;
  exportPayload: unknown;
  createdAt: Date;
};

export type MockGoogleIntegration = {
  id: string;
  storeId: string;
  googleAccountId: string;
  email: string;
  refreshToken: string;
  accessToken: string;
  expiresAt: Date;
  connectedAt: Date;
  lastSyncAt: Date | null;
  analyticsPropertyId: string | null;
  analyticsPropertyName: string | null;
  searchConsoleSiteUrl: string | null;
  searchConsoleSiteName: string | null;
  searchConsoleLastSyncAt: Date | null;
  pageSpeedLastSyncAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type MockMicrosoftClarityIntegration = {
  id: string;
  storeId: string;
  projectId: string;
  projectName: string | null;
  apiToken: string;
  connectedAt: Date;
  lastSyncAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type MockOrder = {
  id: string;
  storeId: string;
  shopifyOrderId: string;
  orderName: string;
  shopifyCreatedAt: Date;
  shopifyUpdatedAt: Date;
  processedAt: Date;
  cancelledAt: Date | null;
  metricDate: Date;
  displayFinancialStatus: string | null;
  currencyCode: string;
  subtotalAmount: unknown;
  totalTaxAmount: unknown;
  totalDiscountAmount: unknown;
  totalPriceAmount: unknown;
  totalRefundedAmount: unknown;
  isTest: boolean;
  isPaid: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type MockOrderLineItem = {
  id: string;
  storeId: string;
  orderId: string;
  shopifyLineItemId: string;
  shopifyOrderId: string;
  shopifyProductId: string | null;
  shopifyVariantId: string | null;
  sku: string | null;
  title: string;
  quantity: number;
  originalUnitPrice: unknown;
  discountedUnitPrice: unknown;
  isGiftCard: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function productKey(storeId: string, shopifyVariantId: string): string {
  return `${storeId}:${shopifyVariantId}`;
}

function orderKey(storeId: string, shopifyOrderId: string): string {
  return `${storeId}:${shopifyOrderId}`;
}

function orderLineItemKey(storeId: string, shopifyLineItemId: string): string {
  return `${storeId}:${shopifyLineItemId}`;
}

function usageRecordKey(
  storeId: string,
  metric: UsageMetric,
  month: string,
): string {
  return `${storeId}:${metric}:${month}`;
}

import { getBillingTrialDays } from "../../../billing/plan-config";
import { buildDbPlanSeedRecords } from "../../../billing/billing-limits";

function seedDefaultPlans(dbState: {
  plans: Map<string, MockPlan>;
  plansBySlug: Map<string, string>;
}) {
  const defaults = buildDbPlanSeedRecords().map((plan) => ({
    id: `plan-${plan.slug}-001`,
    ...plan,
  }));

  dbState.plans.clear();
  dbState.plansBySlug.clear();

  for (const plan of defaults) {
    const row: MockPlan = {
      ...plan,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    dbState.plans.set(row.id, row);
    dbState.plansBySlug.set(row.slug, row.id);
  }
}

function seedDefaultSubscription(dbState: {
  subscriptions: Map<string, MockSubscription>;
  plansBySlug: Map<string, string>;
  stores: Array<{ id: string; firstTrialStartedAt?: Date | null }>;
}) {
  const starterPlanId = dbState.plansBySlug.get("starter");
  if (!starterPlanId) {
    return;
  }

  const now = new Date();
  const trialEndsAt = new Date(now);
  trialEndsAt.setUTCDate(trialEndsAt.getUTCDate() + getBillingTrialDays());

  dbState.subscriptions.set("store-test-001", {
    id: "sub-default-001",
    storeId: "store-test-001",
    planId: starterPlanId,
    status: "trialing",
    currentPeriodStart: now,
    currentPeriodEnd: trialEndsAt,
    trialEndsAt,
    endedAt: null,
    createdAt: now,
    updatedAt: now,
  });

  const store = dbState.stores.find((row) => row.id === "store-test-001");
  if (store) {
    store.firstTrialStartedAt = now;
  }
}

function countSyncJobs(where?: {
  status?: JobStatus | { in: JobStatus[] };
}): number {
  let jobs = [...dbState.syncJobs.values()];

  if (where?.status) {
    const statusFilter = where.status;
    if (typeof statusFilter === "string") {
      jobs = jobs.filter((job) => job.status === statusFilter);
    } else {
      jobs = jobs.filter((job) => statusFilter.in.includes(job.status));
    }
  }

  return jobs.length;
}

function countWebhookEvents(where?: {
  processedSuccessfully?: boolean;
}): number {
  return [...dbState.webhookEvents.values()].filter((event) => {
    if (
      where?.processedSuccessfully !== undefined &&
      event.processedSuccessfully !== where.processedSuccessfully
    ) {
      return false;
    }

    return true;
  }).length;
}

function countStoreOnboardingRows(where?: Record<string, unknown>): number {
  return [...dbState.storeOnboarding.values()].filter((row) => {
    if (!where) {
      return true;
    }

    if (where.status && typeof where.status === "string") {
      if (row.status !== where.status) {
        return false;
      }
    }

    if (
      where.status &&
      typeof where.status === "object" &&
      where.status !== null &&
      "in" in where.status
    ) {
      const statuses = (where.status as { in: OnboardingStatus[] }).in;
      if (!statuses.includes(row.status)) {
        return false;
      }
    }

    if (where.OR && Array.isArray(where.OR)) {
      return (where.OR as Array<Record<string, unknown>>).some((clause) => {
        if (clause.ordersSyncStatus === "blocked") {
          return row.ordersSyncStatus === "blocked";
        }

        if (clause.productSyncStatus === "blocked") {
          return row.productSyncStatus === "blocked";
        }

        if (clause.inventorySyncStatus === "blocked") {
          return row.inventorySyncStatus === "blocked";
        }

        if (
          clause.blockedReason &&
          typeof clause.blockedReason === "object" &&
          clause.blockedReason !== null &&
          "not" in clause.blockedReason &&
          (clause.blockedReason as { not: null }).not === null
        ) {
          return row.blockedReason !== null;
        }

        return false;
      });
    }

    return true;
  }).length;
}

function matchesProductWhere(
  product: MockProduct,
  where: Record<string, unknown>,
): boolean {
  if (where.storeId && product.storeId !== where.storeId) {
    return false;
  }

  if (
    where.shopifyVariantId &&
    typeof where.shopifyVariantId === "object" &&
    where.shopifyVariantId !== null &&
    "notIn" in where.shopifyVariantId
  ) {
    const excluded = (where.shopifyVariantId as { notIn: string[] }).notIn;
    if (excluded.includes(product.shopifyVariantId)) {
      return false;
    }
  }

  if (
    where.shopifyProductId &&
    product.shopifyProductId !== where.shopifyProductId
  ) {
    return false;
  }

  if (
    where.shopifyVariantId &&
    typeof where.shopifyVariantId === "string" &&
    product.shopifyVariantId !== where.shopifyVariantId
  ) {
    return false;
  }

  if (
    where.shopifyProductUpdatedAt &&
    typeof where.shopifyProductUpdatedAt === "object" &&
    where.shopifyProductUpdatedAt !== null &&
    "lt" in where.shopifyProductUpdatedAt
  ) {
    const threshold = (where.shopifyProductUpdatedAt as { lt: Date }).lt;
    if (
      product.shopifyProductUpdatedAt == null ||
      product.shopifyProductUpdatedAt >= threshold
    ) {
      return false;
    }
  }

  if (
    "shopifyProductUpdatedAt" in where &&
    where.shopifyProductUpdatedAt === null &&
    product.shopifyProductUpdatedAt !== null
  ) {
    return false;
  }

  if (where.OR && Array.isArray(where.OR)) {
    const orClauses = where.OR as Array<Record<string, unknown>>;
    const matchesAny = orClauses.some((clause) =>
      matchesProductWhere(product, clause),
    );
    if (!matchesAny) {
      return false;
    }
  }

  if (
    where.shopifyInventoryItemId &&
    typeof where.shopifyInventoryItemId === "object" &&
    where.shopifyInventoryItemId !== null &&
    "not" in where.shopifyInventoryItemId &&
    (where.shopifyInventoryItemId as { not: null }).not === null &&
    product.shopifyInventoryItemId === null
  ) {
    return false;
  }

  if (
    where.shopifyInventoryItemId &&
    typeof where.shopifyInventoryItemId === "string" &&
    product.shopifyInventoryItemId !== where.shopifyInventoryItemId
  ) {
    return false;
  }

  if (where.inventoryTracked === true && !product.inventoryTracked) {
    return false;
  }

  if (where.inventoryTracked === false && product.inventoryTracked) {
    return false;
  }

  if (
    where.status &&
    typeof where.status === "object" &&
    where.status !== null &&
    "not" in where.status
  ) {
    const excludedStatus = (where.status as { not: ProductStatus }).not;
    if (product.status === excludedStatus) {
      return false;
    }
  }

  if (where.inventoryQuantity !== undefined && where.inventoryQuantity !== null) {
    if (typeof where.inventoryQuantity === "number") {
      if (product.inventoryQuantity !== where.inventoryQuantity) {
        return false;
      }
    } else if (typeof where.inventoryQuantity === "object") {
      const quantityFilter = where.inventoryQuantity as Record<string, unknown>;

      if (
        "not" in quantityFilter &&
        quantityFilter.not === null &&
        product.inventoryQuantity === null
      ) {
        return false;
      }

      if (
        "lte" in quantityFilter &&
        typeof quantityFilter.lte === "number" &&
        (product.inventoryQuantity === null ||
          product.inventoryQuantity > quantityFilter.lte)
      ) {
        return false;
      }

      if (
        "gt" in quantityFilter &&
        typeof quantityFilter.gt === "number" &&
        (product.inventoryQuantity === null ||
          product.inventoryQuantity <= quantityFilter.gt)
      ) {
        return false;
      }
    }
  }

  return true;
}

const JOB_PRIORITY_RANK: Record<JobPriority, number> = {
  critical: 1,
  high: 2,
  normal: 3,
  low: 4,
};

function applyWorkerGenerationUpdate(
  current: number,
  value: unknown,
): number {
  if (
    value &&
    typeof value === "object" &&
    "increment" in value &&
    typeof (value as { increment: number }).increment === "number"
  ) {
    return current + (value as { increment: number }).increment;
  }

  if (typeof value === "number") {
    return value;
  }

  return current;
}

function mockClaimNextJob(
  workerId: string,
  claimedAt: Date,
  lockExpiresAt: Date,
  syncJobs: Map<string, MockSyncJob>,
): MockSyncJob[] {
  const now = new Date();
  const eligible = [...syncJobs.values()]
    .filter((job) => job.status === "queued" && job.availableAt <= now)
    .sort((left, right) => {
      const rankDiff =
        JOB_PRIORITY_RANK[left.priority] - JOB_PRIORITY_RANK[right.priority];
      if (rankDiff !== 0) {
        return rankDiff;
      }

      return left.createdAt.getTime() - right.createdAt.getTime();
    });

  const job = eligible[0];
  if (!job) {
    return [];
  }

  job.status = "running";
  job.attempts += 1;
  job.workerGeneration = (job.workerGeneration ?? 0) + 1;
  job.lockedAt = claimedAt;
  job.lockedBy = workerId;
  job.lockExpiresAt = lockExpiresAt;
  job.heartbeatAt = claimedAt;
  job.startedAt = job.startedAt ?? claimedAt;
  job.updatedAt = new Date();
  syncJobs.set(job.id, job);

  return [{ ...job }];
}

const dbState = vi.hoisted(() => ({
  products: new Map<string, MockProduct>(),
  orders: new Map<string, MockOrder>(),
  orderLineItems: new Map<string, MockOrderLineItem>(),
  stores: [
    {
      id: "store-test-001",
      shopifyDomain: "storepilot-test.myshopify.com",
      active: true,
      currency: "USD",
      accessToken: "test-access-token",
      ga4RefreshToken: "test-ga4-refresh-token",
      ga4PropertyId: "properties/123456",
      lastAuthenticatedAt: null as Date | null,
      firstTrialStartedAt: null as Date | null,
      lastProductsSyncAt: null as Date | null,
      lastInventorySyncAt: null as Date | null,
      historicalOrdersImportDone: false,
      lastOrdersSyncAt: null as Date | null,
      ordersSyncCursor: null as string | null,
    },
  ],
  webhookEvents: new Map<string, MockWebhookEvent>(),
  webhookEventsById: new Map<string, MockWebhookEvent>(),
  syncJobs: new Map<string, MockSyncJob>(),
  syncJobsByIdempotency: new Map<string, string>(),
  jobEvents: [] as MockJobEvent[],
  storeOnboarding: new Map<string, MockStoreOnboarding>(),
  plans: new Map<string, MockPlan>(),
  plansBySlug: new Map<string, string>(),
  subscriptions: new Map<string, MockSubscription>(),
  usageRecords: new Map<string, MockUsageRecord>(),
  customerDataExports: new Map<string, MockCustomerDataExport>(),
  customerDataExportsByWebhook: new Map<string, MockCustomerDataExport>(),
  googleIntegrations: new Map<string, MockGoogleIntegration>(),
  microsoftClarityIntegrations: new Map<string, MockMicrosoftClarityIntegration>(),
  sessions: [] as Array<{ id: string; shop: string }>,
  users: [] as Array<{ id: string; storeId: string }>,
}));

seedDefaultPlans(dbState);
seedDefaultSubscription(dbState);

const mockAdminGraphql = vi.hoisted(() => vi.fn());
const transactionChain = vi.hoisted(() => ({
  current: Promise.resolve() as Promise<unknown>,
}));

const prismaMock = vi.hoisted(() => ({
  product: {
    findUnique: vi.fn(
      async ({
        where,
      }: {
        where: {
          storeId_shopifyVariantId?: {
            storeId: string;
            shopifyVariantId: string;
          };
        };
      }) => {
        const key = where.storeId_shopifyVariantId;
        if (!key) {
          return null;
        }

        return (
          dbState.products.get(
            productKey(key.storeId, key.shopifyVariantId),
          ) ?? null
        );
      },
    ),
    findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
      [...dbState.products.values()].filter((product) =>
        matchesProductWhere(product, where),
      ),
    ),
    create: vi.fn(
      async ({
        data,
      }: {
        data: Omit<MockProduct, "id" | "createdAt" | "updatedAt"> & {
          storeId: string;
          shopifyVariantId: string;
        };
      }) => {
        if (
          dbState.products.has(
            productKey(data.storeId, data.shopifyVariantId),
          )
        ) {
          throw new Prisma.PrismaClientKnownRequestError(
            "Unique constraint failed",
            {
              code: "P2002",
              clientVersion: "test",
            },
          );
        }

        const product: MockProduct = {
          id: crypto.randomUUID(),
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
          shopifyProductUpdatedAt: data.shopifyProductUpdatedAt ?? null,
        };
        dbState.products.set(
          productKey(product.storeId, product.shopifyVariantId),
          product,
        );
        return product;
      },
    ),
    update: vi.fn(
      async ({
        where,
        data,
      }: {
        where: {
          storeId_shopifyVariantId: {
            storeId: string;
            shopifyVariantId: string;
          };
        };
        data: Partial<MockProduct>;
      }) => {
        const existing = dbState.products.get(
          productKey(
            where.storeId_shopifyVariantId.storeId,
            where.storeId_shopifyVariantId.shopifyVariantId,
          ),
        );

        if (!existing) {
          throw new Error("Product not found");
        }

        const updated: MockProduct = {
          ...existing,
          ...data,
          updatedAt: new Date(),
        };

        dbState.products.set(
          productKey(updated.storeId, updated.shopifyVariantId),
          updated,
        );
        return updated;
      },
    ),
    updateMany: vi.fn(
      async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Partial<MockProduct>;
      }) => {
        let count = 0;

        for (const [key, product] of dbState.products.entries()) {
          if (!matchesProductWhere(product, where)) {
            continue;
          }

          dbState.products.set(key, {
            ...product,
            ...data,
            updatedAt: new Date(),
          });
          count += 1;
        }

        return { count };
      },
    ),
    count: vi.fn(
      async ({ where }: { where: Record<string, unknown> }) =>
        [...dbState.products.values()].filter((product) =>
          matchesProductWhere(product, where),
        ).length,
    ),
    findFirst: vi.fn(
      async ({
        where,
        select,
      }: {
        where: Record<string, unknown>;
        select?: Record<string, boolean>;
      }) => {
        const product =
          [...dbState.products.values()].find((candidate) =>
            matchesProductWhere(candidate, where),
          ) ?? null;

        if (!product || !select) {
          return product;
        }

        return Object.fromEntries(
          Object.keys(select).map((field) => [
            field,
            product[field as keyof MockProduct],
          ]),
        );
      },
    ),
    deleteMany: vi.fn(
      async ({ where }: { where: { storeId?: string } }) => {
        let count = 0;

        for (const [key, product] of dbState.products.entries()) {
          if (where.storeId && product.storeId !== where.storeId) {
            continue;
          }

          dbState.products.delete(key);
          count += 1;
        }

        return { count };
      },
    ),
    aggregate: vi.fn(
      async ({
        where,
        _sum,
      }: {
        where: Record<string, unknown>;
        _sum?: { inventoryQuantity?: boolean };
      }) => {
        const rows = [...dbState.products.values()].filter((product) =>
          matchesProductWhere(product, where),
        );

        if (_sum?.inventoryQuantity) {
          const total = rows.reduce(
            (sum, product) => sum + (product.inventoryQuantity ?? 0),
            0,
          );

          return {
            _sum: {
              inventoryQuantity: total,
            },
          };
        }

        return { _sum: {} };
      },
    ),
  },
  store: {
    findUnique: vi.fn(
      async ({
        where,
        select,
      }: {
        where: { id?: string; shopifyDomain?: string };
        select?: Record<string, boolean>;
      }) => {
        const store =
          dbState.stores.find((row) =>
            where.id
              ? row.id === where.id
              : row.shopifyDomain === where.shopifyDomain,
          ) ?? null;

        if (!store) {
          return null;
        }

        if (!select) {
          return store;
        }

        return Object.fromEntries(
          Object.keys(select).map((key) => [
            key,
            store[key as keyof typeof store],
          ]),
        );
      },
    ),
    update: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { id?: string; shopifyDomain?: string };
        data: Partial<(typeof dbState.stores)[number]>;
      }) => {
        const store = dbState.stores.find((row) =>
          where.id
            ? row.id === where.id
            : row.shopifyDomain === where.shopifyDomain,
        );
        if (!store) {
          throw new Error("Store not found");
        }

        Object.assign(store, data);
        return store;
      },
    ),
    delete: vi.fn(async ({ where }: { where: { id: string } }) => {
      const index = dbState.stores.findIndex((row) => row.id === where.id);
      if (index === -1) {
        throw new Error("Store not found");
      }

      const [deleted] = dbState.stores.splice(index, 1);
      return deleted;
    }),
    upsert: vi.fn(
      async ({
        where,
        create,
        update,
      }: {
        where: { shopifyDomain: string };
        create: (typeof dbState.stores)[number];
        update: Partial<(typeof dbState.stores)[number]>;
      }) => {
        const index = dbState.stores.findIndex(
          (row) => row.shopifyDomain === where.shopifyDomain,
        );

        if (index === -1) {
          const created = { ...create };
          dbState.stores.push(created);
          return created;
        }

        Object.assign(dbState.stores[index], update);
        return dbState.stores[index];
      },
    ),
    count: vi.fn(
      async (args?: { where?: { active?: boolean } }) => {
        const where = args?.where;
        if (where?.active === true) {
          return dbState.stores.filter((store) => store.active).length;
        }

        if (where?.active === false) {
          return dbState.stores.filter((store) => !store.active).length;
        }

        return dbState.stores.length;
      },
    ),
  },
  order: {
    findUnique: vi.fn(
      async ({
        where,
        select,
      }: {
        where: {
          storeId_shopifyOrderId?: {
            storeId: string;
            shopifyOrderId: string;
          };
        };
        select?: Record<string, boolean>;
      }) => {
        const key = where.storeId_shopifyOrderId;
        if (!key) {
          return null;
        }

        const order =
          dbState.orders.get(orderKey(key.storeId, key.shopifyOrderId)) ?? null;

        if (!order || !select) {
          return order;
        }

        return Object.fromEntries(
          Object.keys(select).map((field) => [
            field,
            order[field as keyof MockOrder],
          ]),
        );
      },
    ),
    create: vi.fn(
      async ({
        data,
        select,
      }: {
        data: Omit<MockOrder, "id" | "createdAt" | "updatedAt">;
        select?: Record<string, boolean>;
      }) => {
        const order: MockOrder = {
          id: crypto.randomUUID(),
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        dbState.orders.set(
          orderKey(order.storeId, order.shopifyOrderId),
          order,
        );

        if (!select) {
          return order;
        }

        return Object.fromEntries(
          Object.keys(select).map((field) => [
            field,
            order[field as keyof MockOrder],
          ]),
        );
      },
    ),
    update: vi.fn(
      async ({
        where,
        data,
      }: {
        where:
          | {
              storeId_shopifyOrderId: {
                storeId: string;
                shopifyOrderId: string;
              };
            }
          | { id: string };
        data: Partial<MockOrder>;
      }) => {
        const existing =
          "id" in where
            ? [...dbState.orders.values()].find((order) => order.id === where.id)
            : dbState.orders.get(
                orderKey(
                  where.storeId_shopifyOrderId.storeId,
                  where.storeId_shopifyOrderId.shopifyOrderId,
                ),
              );

        if (!existing) {
          throw new Error("Order not found");
        }

        const updated: MockOrder = {
          ...existing,
          ...data,
          subtotalAmount:
            data.subtotalAmount != null
              ? String(data.subtotalAmount)
              : existing.subtotalAmount,
          totalTaxAmount:
            data.totalTaxAmount != null
              ? String(data.totalTaxAmount)
              : existing.totalTaxAmount,
          totalDiscountAmount:
            data.totalDiscountAmount != null
              ? String(data.totalDiscountAmount)
              : existing.totalDiscountAmount,
          totalPriceAmount:
            data.totalPriceAmount != null
              ? String(data.totalPriceAmount)
              : existing.totalPriceAmount,
          totalRefundedAmount:
            data.totalRefundedAmount != null
              ? String(data.totalRefundedAmount)
              : existing.totalRefundedAmount,
          updatedAt: new Date(),
        };
        dbState.orders.set(
          orderKey(updated.storeId, updated.shopifyOrderId),
          updated,
        );
        return updated;
      },
    ),
    updateMany: vi.fn(
      async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Partial<MockOrder>;
      }) => {
        let count = 0;

        for (const [key, order] of dbState.orders.entries()) {
          if (where.storeId && order.storeId !== where.storeId) {
            continue;
          }

          if (
            where.shopifyOrderId &&
            order.shopifyOrderId !== where.shopifyOrderId
          ) {
            continue;
          }

          if (
            where.shopifyUpdatedAt &&
            typeof where.shopifyUpdatedAt === "object" &&
            "lt" in where.shopifyUpdatedAt
          ) {
            const threshold = (where.shopifyUpdatedAt as { lt: Date }).lt;
            if (order.shopifyUpdatedAt >= threshold) {
              continue;
            }
          }

          const updated: MockOrder = {
            ...order,
            ...data,
            updatedAt: new Date(),
          };
          dbState.orders.set(key, updated);
          count += 1;
        }

        return { count };
      },
    ),
    count: vi.fn(async ({ where }: { where: { storeId?: string } }) =>
      [...dbState.orders.values()].filter(
        (order) => !where.storeId || order.storeId === where.storeId,
      ).length,
    ),
    findMany: vi.fn(
      async ({
        where,
        select,
        orderBy,
        take,
      }: {
        where: {
          storeId?: string;
          shopifyOrderId?: { in?: string[] };
        };
        select?: Record<string, boolean>;
        orderBy?: { processedAt?: "desc" | "asc" };
        take?: number;
      }) => {
        let rows = [...dbState.orders.values()].filter((order) => {
          if (where.storeId && order.storeId !== where.storeId) {
            return false;
          }

          if (
            where.shopifyOrderId?.in &&
            !where.shopifyOrderId.in.includes(order.shopifyOrderId)
          ) {
            return false;
          }

          return true;
        });

        if (orderBy?.processedAt) {
          rows = rows.sort((left, right) =>
            orderBy.processedAt === "desc"
              ? right.updatedAt.getTime() - left.updatedAt.getTime()
              : left.updatedAt.getTime() - right.updatedAt.getTime(),
          );
        }

        if (take != null) {
          rows = rows.slice(0, take);
        }

        if (!select) {
          return rows;
        }

        return rows.map((order) =>
          Object.fromEntries(
            Object.keys(select).map((field) => [
              field,
              order[field as keyof MockOrder],
            ]),
          ),
        );
      },
    ),
    aggregate: vi.fn(
      async ({
        where,
        _sum,
        _count,
      }: {
        where: { storeId?: string; isPaid?: boolean };
        _sum?: { totalPriceAmount?: boolean };
        _count?: { _all?: boolean };
      }) => {
        const rows = [...dbState.orders.values()].filter((order) => {
          if (where.storeId && order.storeId !== where.storeId) {
            return false;
          }

          if (where.isPaid !== undefined && order.isPaid !== where.isPaid) {
            return false;
          }

          return true;
        });

        const totalPriceAmount = rows.reduce(
          (sum, order) => sum + Number(order.totalPriceAmount ?? 0),
          0,
        );

        return {
          _sum: _sum?.totalPriceAmount
            ? { totalPriceAmount: totalPriceAmount.toFixed(2) }
            : {},
          _count: _count?._all ? { _all: rows.length } : {},
        };
      },
    ),
    deleteMany: vi.fn(async ({ where }: { where: { storeId?: string } }) => {
      let count = 0;

      for (const [key, order] of dbState.orders.entries()) {
        if (where.storeId && order.storeId !== where.storeId) {
          continue;
        }

        dbState.orders.delete(key);
        count += 1;
      }

      return { count };
    }),
  },
  orderLineItem: {
    findUnique: vi.fn(
      async ({
        where,
        select,
      }: {
        where: {
          storeId_shopifyLineItemId?: {
            storeId: string;
            shopifyLineItemId: string;
          };
        };
        select?: Record<string, boolean>;
      }) => {
        const key = where.storeId_shopifyLineItemId;
        if (!key) {
          return null;
        }

        const lineItem =
          dbState.orderLineItems.get(
            orderLineItemKey(key.storeId, key.shopifyLineItemId),
          ) ?? null;

        if (!lineItem || !select) {
          return lineItem;
        }

        return Object.fromEntries(
          Object.keys(select).map((field) => [
            field,
            lineItem[field as keyof MockOrderLineItem],
          ]),
        );
      },
    ),
    create: vi.fn(
      async ({
        data,
        select,
      }: {
        data: Omit<MockOrderLineItem, "id" | "createdAt" | "updatedAt">;
        select?: Record<string, boolean>;
      }) => {
        const lineItem: MockOrderLineItem = {
          id: crypto.randomUUID(),
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        dbState.orderLineItems.set(
          orderLineItemKey(lineItem.storeId, lineItem.shopifyLineItemId),
          lineItem,
        );

        if (!select) {
          return lineItem;
        }

        return Object.fromEntries(
          Object.keys(select).map((field) => [
            field,
            lineItem[field as keyof MockOrderLineItem],
          ]),
        );
      },
    ),
    update: vi.fn(
      async ({
        where,
        data,
      }: {
        where: {
          storeId_shopifyLineItemId: {
            storeId: string;
            shopifyLineItemId: string;
          };
        };
        data: Partial<MockOrderLineItem>;
      }) => {
        const existing = dbState.orderLineItems.get(
          orderLineItemKey(
            where.storeId_shopifyLineItemId.storeId,
            where.storeId_shopifyLineItemId.shopifyLineItemId,
          ),
        );

        if (!existing) {
          throw new Error("Order line item not found");
        }

        const updated: MockOrderLineItem = {
          ...existing,
          ...data,
          updatedAt: new Date(),
        };
        dbState.orderLineItems.set(
          orderLineItemKey(updated.storeId, updated.shopifyLineItemId),
          updated,
        );
        return updated;
      },
    ),
    updateMany: vi.fn(
      async ({
        where,
        data,
      }: {
        where: {
          storeId?: string;
          shopifyOrderId?: string;
          OR?: Array<Record<string, unknown>>;
        };
        data: Partial<MockOrderLineItem>;
      }) => {
        let count = 0;

        for (const [key, lineItem] of dbState.orderLineItems.entries()) {
          if (where.storeId && lineItem.storeId !== where.storeId) {
            continue;
          }

          if (
            where.shopifyOrderId &&
            lineItem.shopifyOrderId !== where.shopifyOrderId
          ) {
            continue;
          }

          if (where.OR && Array.isArray(where.OR)) {
            const matchesAny = where.OR.some((clause) => {
              if (
                clause.title &&
                typeof clause.title === "object" &&
                clause.title !== null &&
                "not" in clause.title
              ) {
                return lineItem.title !== (clause.title as { not: string }).not;
              }

              if (
                clause.sku &&
                typeof clause.sku === "object" &&
                clause.sku !== null &&
                "not" in clause.sku &&
                (clause.sku as { not: null }).not === null
              ) {
                return lineItem.sku !== null;
              }

              if (
                clause.originalUnitPrice &&
                typeof clause.originalUnitPrice === "object" &&
                clause.originalUnitPrice !== null &&
                "not" in clause.originalUnitPrice
              ) {
                const expected = (clause.originalUnitPrice as { not: { toString(): string } }).not;
                return String(lineItem.originalUnitPrice) !== String(expected);
              }

              if (
                clause.discountedUnitPrice &&
                typeof clause.discountedUnitPrice === "object" &&
                clause.discountedUnitPrice !== null &&
                "not" in clause.discountedUnitPrice
              ) {
                const expected = (clause.discountedUnitPrice as { not: { toString(): string } }).not;
                return String(lineItem.discountedUnitPrice) !== String(expected);
              }

              return false;
            });

            if (!matchesAny) {
              continue;
            }
          }

          dbState.orderLineItems.set(key, {
            ...lineItem,
            ...data,
            originalUnitPrice:
              data.originalUnitPrice != null
                ? String(data.originalUnitPrice)
                : lineItem.originalUnitPrice,
            discountedUnitPrice:
              data.discountedUnitPrice != null
                ? String(data.discountedUnitPrice)
                : lineItem.discountedUnitPrice,
            updatedAt: new Date(),
          });
          count += 1;
        }

        return { count };
      },
    ),
    count: vi.fn(
      async ({
        where,
      }: {
        where: {
          storeId?: string;
          shopifyOrderId?: { in?: string[] };
        };
      }) =>
        [...dbState.orderLineItems.values()].filter((lineItem) => {
          if (where.storeId && lineItem.storeId !== where.storeId) {
            return false;
          }

          if (
            where.shopifyOrderId?.in &&
            !where.shopifyOrderId.in.includes(lineItem.shopifyOrderId)
          ) {
            return false;
          }

          return true;
        }).length,
    ),
    findMany: vi.fn(
      async ({
        where,
        select,
      }: {
        where: {
          storeId?: string;
          shopifyOrderId?: { in?: string[] };
        };
        select?: Record<string, boolean>;
      }) => {
        const rows = [...dbState.orderLineItems.values()].filter((lineItem) => {
          if (where.storeId && lineItem.storeId !== where.storeId) {
            return false;
          }

          if (
            where.shopifyOrderId?.in &&
            !where.shopifyOrderId.in.includes(lineItem.shopifyOrderId)
          ) {
            return false;
          }

          return true;
        });

        if (!select) {
          return rows;
        }

        return rows.map((lineItem) =>
          Object.fromEntries(
            Object.keys(select).map((field) => [
              field,
              lineItem[field as keyof MockOrderLineItem],
            ]),
          ),
        );
      },
    ),
    deleteMany: vi.fn(
      async ({
        where,
      }: {
        where: {
          storeId?: string;
          orderId?: string;
          shopifyLineItemId?: { notIn: string[] };
        };
      }) => {
        let count = 0;

        for (const [key, lineItem] of dbState.orderLineItems.entries()) {
          if (where.storeId && lineItem.storeId !== where.storeId) {
            continue;
          }

          if (where.orderId && lineItem.orderId !== where.orderId) {
            continue;
          }

          if (
            where.shopifyLineItemId?.notIn.includes(lineItem.shopifyLineItemId)
          ) {
            continue;
          }

          dbState.orderLineItems.delete(key);
          count += 1;
        }

        return { count };
      },
    ),
  },
  webhookEvent: {
    findUnique: vi.fn(
      async ({
        where,
        select,
      }: {
        where: { shopifyWebhookId?: string; id?: string };
        select?: Record<string, boolean>;
      }) => {
        const event = where.shopifyWebhookId
          ? dbState.webhookEvents.get(where.shopifyWebhookId)
          : where.id
            ? dbState.webhookEventsById.get(where.id)
            : undefined;

        if (!event) {
          return null;
        }

        if (!select) {
          return event;
        }

        return Object.fromEntries(
          Object.keys(select).map((key) => [
            key,
            event[key as keyof MockWebhookEvent],
          ]),
        );
      },
    ),
    findMany: vi.fn(
      async ({
        where,
        select,
        orderBy,
        take,
      }: {
        where: {
          storeId?: string;
          topic?: { in?: string[] };
        };
        select?: Record<string, boolean>;
        orderBy?: { processedAt?: "desc" | "asc" };
        take?: number;
      }) => {
        let rows = [...dbState.webhookEventsById.values()].filter((event) => {
          if (where.storeId && event.storeId !== where.storeId) {
            return false;
          }

          if (where.topic?.in && !where.topic.in.includes(event.topic)) {
            return false;
          }

          return true;
        });

        if (orderBy?.processedAt) {
          rows = rows.sort((left, right) => {
            const leftTime = left.processedAt?.getTime() ?? 0;
            const rightTime = right.processedAt?.getTime() ?? 0;
            return orderBy.processedAt === "desc"
              ? rightTime - leftTime
              : leftTime - rightTime;
          });
        }

        if (take != null) {
          rows = rows.slice(0, take);
        }

        if (!select) {
          return rows;
        }

        return rows.map((event) =>
          Object.fromEntries(
            Object.keys(select).map((field) => [
              field,
              event[field as keyof MockWebhookEvent],
            ]),
          ),
        );
      },
    ),
    findFirst: vi.fn(
      async ({
        where,
        orderBy,
        select,
      }: {
        where: { storeId?: string; topic?: { in?: string[] } };
        orderBy?: { createdAt?: "desc" | "asc"; processedAt?: "desc" | "asc" };
        select?: Record<string, boolean>;
      }) => {
        let rows = [...dbState.webhookEventsById.values()].filter((event) => {
          if (where.storeId && event.storeId !== where.storeId) {
            return false;
          }

          if (where.topic?.in && !where.topic.in.includes(event.topic)) {
            return false;
          }

          return true;
        });

        if (orderBy?.createdAt) {
          rows = rows.sort((left, right) => {
            const leftTime = left.createdAt.getTime();
            const rightTime = right.createdAt.getTime();
            return orderBy.createdAt === "desc"
              ? rightTime - leftTime
              : leftTime - rightTime;
          });
        }

        if (orderBy?.processedAt) {
          rows = rows.sort((left, right) => {
            const leftTime = left.processedAt?.getTime() ?? 0;
            const rightTime = right.processedAt?.getTime() ?? 0;
            return orderBy.processedAt === "desc"
              ? rightTime - leftTime
              : leftTime - rightTime;
          });
        }

        const event = rows[0] ?? null;
        if (!event) {
          return null;
        }

        if (!select) {
          return event;
        }

        return Object.fromEntries(
          Object.keys(select).map((field) => [
            field,
            event[field as keyof MockWebhookEvent],
          ]),
        );
      },
    ),
    groupBy: vi.fn(async () => []),
    create: vi.fn(
      async ({
        data,
      }: {
        data: Omit<MockWebhookEvent, "id" | "createdAt"> & {
          processedAt?: Date | null;
          processingOwner?: string | null;
          processingExpiresAt?: Date | null;
        };
      }) => {
        if (dbState.webhookEvents.has(data.shopifyWebhookId)) {
          throw new Prisma.PrismaClientKnownRequestError(
            "Unique constraint failed",
            {
              code: "P2002",
              clientVersion: "test",
            },
          );
        }

        const event: MockWebhookEvent = {
          id: crypto.randomUUID(),
          createdAt: new Date(),
          ...data,
          processedAt: data.processedAt ?? null,
          processingOwner: data.processingOwner ?? null,
          processingExpiresAt: data.processingExpiresAt ?? null,
        };

        dbState.webhookEvents.set(event.shopifyWebhookId, event);
        dbState.webhookEventsById.set(event.id, event);
        return event;
      },
    ),
    updateMany: vi.fn(
      async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Partial<MockWebhookEvent>;
      }) => {
        let count = 0;
        const _now = new Date();

        for (const event of dbState.webhookEventsById.values()) {
          if (where.id && event.id !== where.id) {
            continue;
          }

          if (
            where.processedSuccessfully === false &&
            event.processedSuccessfully !== false
          ) {
            continue;
          }

          if (
            where.processingOwner &&
            event.processingOwner !== where.processingOwner
          ) {
            continue;
          }

          if (where.OR && Array.isArray(where.OR)) {
            const orClauses = where.OR as Array<Record<string, unknown>>;
            const leaseOpen = orClauses.some((clause) => {
              if (clause.processingOwner === null && event.processingOwner != null) {
                return false;
              }
              if (clause.processingExpiresAt === null && event.processingExpiresAt != null) {
                return false;
              }
              if (
                clause.processingExpiresAt &&
                typeof clause.processingExpiresAt === "object" &&
                "lt" in clause.processingExpiresAt
              ) {
                const threshold = (clause.processingExpiresAt as { lt: Date }).lt;
                return (
                  event.processingExpiresAt != null &&
                  event.processingExpiresAt < threshold
                );
              }
              return true;
            });

            if (!leaseOpen) {
              continue;
            }
          }

          Object.assign(event, data);
          dbState.webhookEvents.set(event.shopifyWebhookId, event);
          count += 1;
        }

        return { count };
      },
    ),
    update: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<MockWebhookEvent>;
      }) => {
        const event = dbState.webhookEventsById.get(where.id);
        if (!event) {
          throw new Error("Webhook event not found");
        }

        Object.assign(event, data);
        dbState.webhookEvents.set(event.shopifyWebhookId, event);
        return event;
      },
    ),
    count: vi.fn(
      async (args?: { where?: { processedSuccessfully?: boolean } }) =>
        countWebhookEvents(args?.where),
    ),
    deleteMany: vi.fn(async ({ where }: { where: { storeId?: string } }) => {
      let count = 0;

      for (const [key, event] of dbState.webhookEvents.entries()) {
        if (where.storeId && event.storeId !== where.storeId) {
          continue;
        }

        dbState.webhookEvents.delete(key);
        dbState.webhookEventsById.delete(event.id);
        count += 1;
      }

      return { count };
    }),
  },
  syncJob: {
    findUnique: vi.fn(
      async ({
        where,
      }: {
        where: { id?: string; idempotencyKey?: string; storeId?: string };
      }) => {
        if (where.id) {
          return dbState.syncJobs.get(where.id) ?? null;
        }

        if (where.idempotencyKey) {
          const jobId = dbState.syncJobsByIdempotency.get(where.idempotencyKey);
          return jobId ? (dbState.syncJobs.get(jobId) ?? null) : null;
        }

        return null;
      },
    ),
    findFirst: vi.fn(async () => null),
    create: vi.fn(
      async ({
        data,
      }: {
        data: {
          storeId: string;
          jobType: JobType;
          idempotencyKey: string;
          maxAttempts: number;
          priority?: JobPriority;
          payload?: unknown;
          availableAt?: Date;
        };
      }) => {
        if (dbState.syncJobsByIdempotency.has(data.idempotencyKey)) {
          throw new Prisma.PrismaClientKnownRequestError(
            "Unique constraint failed",
            {
              code: "P2002",
              clientVersion: "test",
            },
          );
        }

        const job: MockSyncJob = {
          id: crypto.randomUUID(),
          storeId: data.storeId,
          jobType: data.jobType,
          status: "queued",
          priority: data.priority ?? "normal",
          payload: data.payload ?? {},
          cursorJson: null,
          progressJson: null,
          attempts: 0,
          maxAttempts: data.maxAttempts,
          availableAt: data.availableAt ?? new Date(),
          startedAt: null,
          completedAt: null,
          failedAt: null,
          deadLetterAt: null,
          cancelledAt: null,
          errorCode: null,
          errorMessage: null,
          idempotencyKey: data.idempotencyKey,
          lockedBy: null,
          lockedAt: null,
          lockExpiresAt: null,
          heartbeatAt: null,
          durationMs: null,
          workerGeneration: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        dbState.syncJobs.set(job.id, job);
        dbState.syncJobsByIdempotency.set(job.idempotencyKey, job.id);
        return job;
      },
    ),
    updateMany: vi.fn(
      async ({
        where,
        data,
      }: {
        where: {
          storeId?: string;
          status?: JobStatus | { in: JobStatus[] };
        };
        data: Partial<MockSyncJob> & {
          workerGeneration?: number | { increment: number };
        };
      }) => {
        let count = 0;

        for (const [key, job] of dbState.syncJobs.entries()) {
          if (where.storeId && job.storeId !== where.storeId) {
            continue;
          }

          if (where.status) {
            const statusFilter = where.status;
            if (typeof statusFilter === "string") {
              if (job.status !== statusFilter) {
                continue;
              }
            } else if (!statusFilter.in.includes(job.status)) {
              continue;
            }
          }

          const updated: MockSyncJob = {
            ...job,
            ...(Object.fromEntries(
              Object.entries(data).filter(
                ([key]) => key !== "workerGeneration",
              ),
            ) as Partial<MockSyncJob>),
            workerGeneration: applyWorkerGenerationUpdate(
              job.workerGeneration,
              data.workerGeneration,
            ),
            updatedAt: new Date(),
          };
          dbState.syncJobs.set(key, updated);
          count += 1;
        }

        return { count };
      },
    ),
    update: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { id: string; storeId?: string };
        data: Partial<MockSyncJob> & {
          workerGeneration?: number | { increment: number };
        };
      }) => {
        const existing = dbState.syncJobs.get(where.id);
        if (!existing) {
          throw new Error("Sync job not found");
        }

        if (where.storeId && existing.storeId !== where.storeId) {
          throw new Error("Sync job not found");
        }

        const nextGeneration = applyWorkerGenerationUpdate(
          existing.workerGeneration,
          data.workerGeneration,
        );

        const { workerGeneration: _ignored, ...restData } = data;

        const updated: MockSyncJob = {
          ...existing,
          ...restData,
          workerGeneration: nextGeneration,
          updatedAt: new Date(),
        };
        dbState.syncJobs.set(updated.id, updated);
        return updated;
      },
    ),
    findMany: vi.fn(
      async ({
        where,
        orderBy,
      }: {
        where?: {
          status?: JobStatus;
          lockExpiresAt?: { lt: Date };
        };
        orderBy?: { lockExpiresAt?: "asc" | "desc" };
      }) => {
        let jobs = [...dbState.syncJobs.values()];

        if (where?.status) {
          jobs = jobs.filter((job) => job.status === where.status);
        }

        if (where?.lockExpiresAt?.lt) {
          jobs = jobs.filter(
            (job) =>
              job.lockExpiresAt !== null &&
              job.lockExpiresAt < where.lockExpiresAt!.lt,
          );
        }

        if (orderBy?.lockExpiresAt === "asc") {
          jobs.sort(
            (left, right) =>
              (left.lockExpiresAt?.getTime() ?? 0) -
              (right.lockExpiresAt?.getTime() ?? 0),
          );
        }

        return jobs;
      },
    ),
    count: vi.fn(
      async (args?: {
        where?: { status?: JobStatus | { in: JobStatus[] } };
      }) => countSyncJobs(args?.where),
    ),
    deleteMany: vi.fn(async ({ where }: { where: { storeId?: string } }) => {
      let count = 0;

      for (const [key, job] of dbState.syncJobs.entries()) {
        if (where.storeId && job.storeId !== where.storeId) {
          continue;
        }

        dbState.syncJobs.delete(key);
        dbState.syncJobsByIdempotency.delete(job.idempotencyKey);
        count += 1;
      }

      return { count };
    }),
  },
  jobEvent: {
    create: vi.fn(
      async ({
        data,
      }: {
        data: Omit<MockJobEvent, "id" | "createdAt">;
      }) => {
        const event: MockJobEvent = {
          id: crypto.randomUUID(),
          createdAt: new Date(),
          ...data,
        };
        dbState.jobEvents.push(event);
        return event;
      },
    ),
    findMany: vi.fn(
      async ({
        where,
        orderBy,
      }: {
        where?: { jobId?: string };
        orderBy?: { createdAt?: "asc" | "desc" };
      }) => {
        let events = [...dbState.jobEvents];
        if (where?.jobId) {
          events = events.filter((event) => event.jobId === where.jobId);
        }

        if (orderBy?.createdAt === "asc") {
          events.sort(
            (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
          );
        }

        return events;
      },
    ),
    deleteMany: vi.fn(async ({ where }: { where: { storeId?: string } }) => {
      const before = dbState.jobEvents.length;
      dbState.jobEvents = dbState.jobEvents.filter(
        (event) => event.storeId !== where.storeId,
      );
      return { count: before - dbState.jobEvents.length };
    }),
  },
  storeOnboarding: {
    findUnique: vi.fn(
      async ({
        where,
        select,
      }: {
        where: { storeId?: string; id?: string };
        select?: Record<string, boolean>;
      }) => {
        let row: MockStoreOnboarding | null = null;

        if (where.storeId) {
          row = dbState.storeOnboarding.get(where.storeId) ?? null;
        } else if (where.id) {
          row =
            [...dbState.storeOnboarding.values()].find(
              (candidate) => candidate.id === where.id,
            ) ?? null;
        }

        if (!row) {
          return null;
        }

        if (!select) {
          return row;
        }

        return Object.fromEntries(
          Object.keys(select).map((key) => [
            key,
            row![key as keyof MockStoreOnboarding],
          ]),
        );
      },
    ),
    findUniqueOrThrow: vi.fn(async ({ where }: { where: { storeId: string } }) => {
      const row = dbState.storeOnboarding.get(where.storeId);
      if (!row) {
        throw new Error("Store onboarding not found");
      }

      return row;
    }),
    create: vi.fn(
      async ({
        data,
      }: {
        data: {
          storeId: string;
          onboardingRunId: string;
          status?: OnboardingStatus;
          productSyncStatus?: OnboardingPhaseStatus;
          inventorySyncStatus?: OnboardingPhaseStatus;
          ordersSyncStatus?: OnboardingPhaseStatus;
          googleAnalyticsSkippedAt?: Date | null;
        };
      }) => {
        if (dbState.storeOnboarding.has(data.storeId)) {
          throw new Prisma.PrismaClientKnownRequestError(
            "Unique constraint failed",
            {
              code: "P2002",
              clientVersion: "test",
            },
          );
        }

        const row: MockStoreOnboarding = {
          id: crypto.randomUUID(),
          storeId: data.storeId,
          onboardingRunId: data.onboardingRunId,
          status: data.status ?? "not_started",
          currentJobId: null,
          productSyncStatus: data.productSyncStatus ?? "not_started",
          productSyncJobId: null,
          productSyncCompletedAt: null,
          inventorySyncStatus: data.inventorySyncStatus ?? "not_started",
          inventorySyncJobId: null,
          inventorySyncCompletedAt: null,
          ordersSyncStatus: data.ordersSyncStatus ?? "not_started",
          ordersSyncJobId: null,
          ordersSyncCompletedAt: null,
          blockedReason: null,
          blockedMessage: null,
          degradedReason: null,
          progressPercent: 0,
          progressLabel: null,
          lastErrorCode: null,
          lastErrorMessage: null,
          attempts: 0,
          maxAttempts: 5,
          startedAt: null,
          coreCompletedAt: null,
          completedAt: null,
          fullCompletedAt: null,
          failedAt: null,
          googleAnalyticsSkippedAt: data.googleAnalyticsSkippedAt ?? null,
          ownershipRepairPending: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        dbState.storeOnboarding.set(row.storeId, row);
        return row;
      },
    ),
    update: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { storeId: string };
        data: Partial<MockStoreOnboarding>;
      }) => {
        const existing = dbState.storeOnboarding.get(where.storeId);
        if (!existing) {
          throw new Error("Store onboarding not found");
        }

        const updated: MockStoreOnboarding = {
          ...existing,
          ...data,
          updatedAt: new Date(),
        };
        dbState.storeOnboarding.set(updated.storeId, updated);
        return updated;
      },
    ),
    updateMany: vi.fn(
      async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Partial<MockStoreOnboarding>;
      }) => {
        const storeId = where.storeId as string | undefined;
        if (!storeId) {
          return { count: 0 };
        }

        const existing = dbState.storeOnboarding.get(storeId);
        if (!existing) {
          return { count: 0 };
        }

        for (const [key, expected] of Object.entries(where)) {
          if (key === "storeId") {
            continue;
          }

          const actual = existing[key as keyof MockStoreOnboarding];

          if (
            expected &&
            typeof expected === "object" &&
            expected !== null &&
            "in" in expected &&
            Array.isArray((expected as { in: unknown[] }).in)
          ) {
            if (!(expected as { in: unknown[] }).in.includes(actual)) {
              return { count: 0 };
            }
            continue;
          }

          if (actual !== expected) {
            return { count: 0 };
          }
        }

        const updated: MockStoreOnboarding = {
          ...existing,
          ...data,
          updatedAt: new Date(),
        };
        dbState.storeOnboarding.set(updated.storeId, updated);
        return { count: 1 };
      },
    ),
    count: vi.fn(
      async (args?: { where?: Record<string, unknown> }) =>
        countStoreOnboardingRows(args?.where),
    ),
    findMany: vi.fn(
      async ({
        where,
        include,
        orderBy,
      }: {
        where?: Record<string, unknown>;
        include?: { currentJob?: boolean };
        orderBy?: { updatedAt?: "asc" | "desc" };
      }) => {
        let rows = [...dbState.storeOnboarding.values()];

        if (where?.status && typeof where.status === "object" && where.status !== null && "notIn" in where.status) {
          const excluded = (where.status as { notIn: OnboardingStatus[] }).notIn;
          rows = rows.filter((row) => !excluded.includes(row.status));
        }

        if (where?.ownershipRepairPending === true) {
          rows = rows.filter((row) => row.ownershipRepairPending === true);
        }

        if (
          where?.currentJobId &&
          typeof where.currentJobId === "object" &&
          where.currentJobId !== null &&
          "not" in where.currentJobId &&
          (where.currentJobId as { not: null }).not === null
        ) {
          rows = rows.filter((row) => row.currentJobId !== null);
        }

        if (where?.OR && Array.isArray(where.OR)) {
          rows = rows.filter((row) => {
            const currentJob = row.currentJobId
              ? dbState.syncJobs.get(row.currentJobId) ?? null
              : null;

            return (where.OR as Array<Record<string, unknown>>).some((clause) => {
              if (clause.updatedAt && typeof clause.updatedAt === "object" && clause.updatedAt !== null && "lt" in clause.updatedAt) {
                return row.updatedAt < (clause.updatedAt as { lt: Date }).lt;
              }

              if (clause.currentJob && typeof clause.currentJob === "object" && clause.currentJob !== null) {
                const jobClause = clause.currentJob as Record<string, unknown>;

                if (jobClause.status && typeof jobClause.status === "object" && jobClause.status !== null && "in" in jobClause.status) {
                  return (
                    currentJob !== null &&
                    (jobClause.status as { in: JobStatus[] }).in.includes(
                      currentJob.status,
                    )
                  );
                }

                if (jobClause.status === "running") {
                  if (
                    jobClause.lockExpiresAt &&
                    typeof jobClause.lockExpiresAt === "object" &&
                    jobClause.lockExpiresAt !== null &&
                    "lt" in jobClause.lockExpiresAt
                  ) {
                    return (
                      currentJob?.status === "running" &&
                      currentJob.lockExpiresAt !== null &&
                      currentJob.lockExpiresAt <
                        (jobClause.lockExpiresAt as { lt: Date }).lt
                    );
                  }

                  if (
                    jobClause.heartbeatAt &&
                    typeof jobClause.heartbeatAt === "object" &&
                    jobClause.heartbeatAt !== null &&
                    "lt" in jobClause.heartbeatAt
                  ) {
                    return (
                      currentJob?.status === "running" &&
                      currentJob.heartbeatAt !== null &&
                      currentJob.heartbeatAt <
                        (jobClause.heartbeatAt as { lt: Date }).lt
                    );
                  }
                }
              }

              return false;
            });
          });
        }

        if (orderBy?.updatedAt === "asc") {
          rows.sort(
            (left, right) => left.updatedAt.getTime() - right.updatedAt.getTime(),
          );
        }

        if (include?.currentJob) {
          return rows.map((row) => ({
            ...row,
            currentJob: row.currentJobId
              ? (dbState.syncJobs.get(row.currentJobId) ?? null)
              : null,
          }));
        }

        return rows;
      },
    ),
    deleteMany: vi.fn(async ({ where }: { where: { storeId?: string } }) => {
      let count = 0;

      for (const [key, row] of dbState.storeOnboarding.entries()) {
        if (where.storeId && row.storeId !== where.storeId) {
          continue;
        }

        dbState.storeOnboarding.delete(key);
        count += 1;
      }

      return { count };
    }),
  },
  plan: {
    findUnique: vi.fn(
      async ({
        where,
      }: {
        where: { id?: string; slug?: string };
      }) => {
        if (where.id) {
          return dbState.plans.get(where.id) ?? null;
        }

        if (where.slug) {
          const planId = dbState.plansBySlug.get(where.slug);
          return planId ? (dbState.plans.get(planId) ?? null) : null;
        }

        return null;
      },
    ),
    findMany: vi.fn(async () => [...dbState.plans.values()]),
  },
  googleIntegration: {
    findUnique: vi.fn(async ({ where }: { where: { storeId?: string } }) => {
      if (!where.storeId) return null;
      return dbState.googleIntegrations.get(where.storeId) ?? null;
    }),
    findFirst: vi.fn(
      async ({
        where,
      }: {
        where: {
          storeId?: string;
          isActive?: boolean;
          analyticsPropertyId?: { not: null };
          searchConsoleSiteUrl?: { not: null };
        };
      }) => {
        const row = where.storeId
          ? (dbState.googleIntegrations.get(where.storeId) ?? null)
          : null;
        if (!row) return null;
        if (where.isActive === true && !row.isActive) return null;
        if (where.analyticsPropertyId?.not === null && !row.analyticsPropertyId) return null;
        if (where.searchConsoleSiteUrl?.not === null && !row.searchConsoleSiteUrl) return null;
        return row;
      },
    ),
    upsert: vi.fn(
      async ({
        where,
        create,
        update,
      }: {
        where: { storeId: string };
        create: Partial<MockGoogleIntegration> & { storeId: string };
        update: Partial<MockGoogleIntegration>;
      }) => {
        const existing = dbState.googleIntegrations.get(where.storeId);
        const next: MockGoogleIntegration = existing
          ? {
              ...existing,
              ...update,
              updatedAt: new Date(),
            }
          : {
              id: crypto.randomUUID(),
              storeId: where.storeId,
              googleAccountId: create.googleAccountId ?? "google-account",
              email: create.email ?? "merchant@store.com",
              refreshToken: create.refreshToken ?? "refresh",
              accessToken: create.accessToken ?? "access",
              expiresAt: create.expiresAt ?? new Date(Date.now() + 3600_000),
              connectedAt: create.connectedAt ?? new Date(),
              lastSyncAt: create.lastSyncAt ?? null,
              analyticsPropertyId: create.analyticsPropertyId ?? null,
              analyticsPropertyName: create.analyticsPropertyName ?? null,
              searchConsoleSiteUrl: create.searchConsoleSiteUrl ?? null,
              searchConsoleSiteName: create.searchConsoleSiteName ?? null,
              searchConsoleLastSyncAt: create.searchConsoleLastSyncAt ?? null,
              pageSpeedLastSyncAt: create.pageSpeedLastSyncAt ?? null,
              isActive: create.isActive ?? true,
              createdAt: new Date(),
              updatedAt: new Date(),
            };

        dbState.googleIntegrations.set(where.storeId, next);
        return next;
      },
    ),
    update: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { storeId: string };
        data: Partial<MockGoogleIntegration>;
      }) => {
        const existing = dbState.googleIntegrations.get(where.storeId);
        if (!existing) {
          throw new Error("Google integration not found");
        }

        const updated = { ...existing, ...data, updatedAt: new Date() };
        dbState.googleIntegrations.set(where.storeId, updated);
        return updated;
      },
    ),
    updateMany: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { storeId?: string };
        data: Partial<MockGoogleIntegration>;
      }) => {
        let count = 0;
        for (const [key, row] of dbState.googleIntegrations.entries()) {
          if (where.storeId && row.storeId !== where.storeId) continue;
          dbState.googleIntegrations.set(key, { ...row, ...data, updatedAt: new Date() });
          count += 1;
        }
        return { count };
      },
    ),
    deleteMany: vi.fn(async ({ where }: { where: { storeId?: string } }) => {
      let count = 0;
      for (const [key, row] of dbState.googleIntegrations.entries()) {
        if (where.storeId && row.storeId !== where.storeId) continue;
        dbState.googleIntegrations.delete(key);
        count += 1;
      }
      return { count };
    }),
  },
  microsoftClarityIntegration: {
    findUnique: vi.fn(async ({ where }: { where: { storeId?: string } }) => {
      if (!where.storeId) return null;
      return dbState.microsoftClarityIntegrations.get(where.storeId) ?? null;
    }),
    findFirst: vi.fn(
      async ({
        where,
      }: {
        where: {
          storeId?: string;
          isActive?: boolean;
          projectId?: { not: null | "" };
          apiToken?: { not: null | "" };
        };
      }) => {
        const row = where.storeId
          ? (dbState.microsoftClarityIntegrations.get(where.storeId) ?? null)
          : null;
        if (!row) return null;
        if (where.isActive === true && !row.isActive) return null;
        if (where.projectId?.not === null && !row.projectId) return null;
        if (where.projectId?.not === "" && !row.projectId) return null;
        if (where.apiToken?.not === null && !row.apiToken) return null;
        if (where.apiToken?.not === "" && !row.apiToken) return null;
        return row;
      },
    ),
    upsert: vi.fn(
      async ({
        where,
        create,
        update,
      }: {
        where: { storeId: string };
        create: Partial<MockMicrosoftClarityIntegration> & { storeId: string };
        update: Partial<MockMicrosoftClarityIntegration>;
      }) => {
        const existing = dbState.microsoftClarityIntegrations.get(where.storeId);
        const next: MockMicrosoftClarityIntegration = existing
          ? {
              ...existing,
              ...update,
              updatedAt: new Date(),
            }
          : {
              id: crypto.randomUUID(),
              storeId: where.storeId,
              projectId: create.projectId ?? "clarity-project",
              projectName: create.projectName ?? null,
              apiToken: create.apiToken ?? "token",
              connectedAt: create.connectedAt ?? new Date(),
              lastSyncAt: create.lastSyncAt ?? null,
              isActive: create.isActive ?? true,
              createdAt: new Date(),
              updatedAt: new Date(),
            };

        dbState.microsoftClarityIntegrations.set(where.storeId, next);
        return next;
      },
    ),
    update: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { storeId: string };
        data: Partial<MockMicrosoftClarityIntegration>;
      }) => {
        const existing = dbState.microsoftClarityIntegrations.get(where.storeId);
        if (!existing) {
          throw new Error("Microsoft Clarity integration not found");
        }

        const updated = { ...existing, ...data, updatedAt: new Date() };
        dbState.microsoftClarityIntegrations.set(where.storeId, updated);
        return updated;
      },
    ),
    updateMany: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { storeId?: string };
        data: Partial<MockMicrosoftClarityIntegration>;
      }) => {
        let count = 0;
        for (const [key, row] of dbState.microsoftClarityIntegrations.entries()) {
          if (where.storeId && row.storeId !== where.storeId) continue;
          dbState.microsoftClarityIntegrations.set(key, { ...row, ...data, updatedAt: new Date() });
          count += 1;
        }
        return { count };
      },
    ),
    deleteMany: vi.fn(async ({ where }: { where: { storeId?: string } }) => {
      let count = 0;
      for (const [key, row] of dbState.microsoftClarityIntegrations.entries()) {
        if (where.storeId && row.storeId !== where.storeId) continue;
        dbState.microsoftClarityIntegrations.delete(key);
        count += 1;
      }
      return { count };
    }),
  },
  customerDataExport: {
    create: vi.fn(
      async ({
        data,
      }: {
        data: Omit<MockCustomerDataExport, "id" | "createdAt">;
      }) => {
        const webhookKey = `${data.storeId}:${data.shopifyWebhookId}`;
        if (dbState.customerDataExportsByWebhook.has(webhookKey)) {
          throw new Prisma.PrismaClientKnownRequestError(
            "Unique constraint failed",
            {
              code: "P2002",
              clientVersion: "test",
            },
          );
        }

        const created: MockCustomerDataExport = {
          id: crypto.randomUUID(),
          ...data,
          createdAt: new Date(),
        };
        dbState.customerDataExports.set(created.id, created);
        dbState.customerDataExportsByWebhook.set(webhookKey, created);
        return created;
      },
    ),
    findUnique: vi.fn(
      async ({
        where,
        select,
      }: {
        where: { id?: string; storeId_shopifyWebhookId?: { storeId: string; shopifyWebhookId: string } };
        select?: Record<string, boolean>;
      }) => {
        let record: MockCustomerDataExport | undefined;

        if (where.id) {
          record = dbState.customerDataExports.get(where.id);
        } else if (where.storeId_shopifyWebhookId) {
          const key = `${where.storeId_shopifyWebhookId.storeId}:${where.storeId_shopifyWebhookId.shopifyWebhookId}`;
          record = dbState.customerDataExportsByWebhook.get(key);
        }

        if (!record) {
          return null;
        }

        if (!select) {
          return record;
        }

        return Object.fromEntries(
          Object.keys(select).map((field) => [
            field,
            record![field as keyof MockCustomerDataExport],
          ]),
        );
      },
    ),
    findFirst: vi.fn(
      async ({
        where,
        select,
      }: {
        where: { id?: string; storeId?: string };
        select?: Record<string, boolean>;
      }) => {
        let record: MockCustomerDataExport | undefined;

        for (const candidate of dbState.customerDataExports.values()) {
          if (where.id && candidate.id !== where.id) {
            continue;
          }

          if (where.storeId && candidate.storeId !== where.storeId) {
            continue;
          }

          record = candidate;
          break;
        }

        if (!record) {
          return null;
        }

        if (!select) {
          return record;
        }

        return Object.fromEntries(
          Object.keys(select).map((field) => [
            field,
            record![field as keyof MockCustomerDataExport],
          ]),
        );
      },
    ),
    deleteMany: vi.fn(
      async ({
        where,
      }: {
        where: {
          storeId?: string;
          shopifyCustomerId?: string;
        };
      }) => {
        let count = 0;

        for (const [id, record] of dbState.customerDataExports.entries()) {
          if (where.storeId && record.storeId !== where.storeId) {
            continue;
          }

          if (
            where.shopifyCustomerId &&
            record.shopifyCustomerId !== where.shopifyCustomerId
          ) {
            continue;
          }

          dbState.customerDataExports.delete(id);
          dbState.customerDataExportsByWebhook.delete(
            `${record.storeId}:${record.shopifyWebhookId}`,
          );
          count += 1;
        }

        return { count };
      },
    ),
  },
  subscription: {
    findFirst: vi.fn(
      async ({
        where,
        orderBy: _orderBy,
      }: {
        where: { storeId?: string };
        orderBy?: { updatedAt: "desc" };
      }) => {
        if (!where.storeId) {
          return null;
        }

        const subscription = dbState.subscriptions.get(where.storeId) ?? null;
        return subscription;
      },
    ),
    findUnique: vi.fn(
      async ({
        where,
        include,
      }: {
        where: { storeId?: string; id?: string };
        include?: { plan?: boolean };
      }) => {
        let subscription: MockSubscription | null = null;

        if (where.storeId) {
          subscription = dbState.subscriptions.get(where.storeId) ?? null;
        } else if (where.id) {
          subscription =
            [...dbState.subscriptions.values()].find(
              (row) => row.id === where.id,
            ) ?? null;
        }

        if (!subscription) {
          return null;
        }

        if (!include?.plan) {
          return subscription;
        }

        return {
          ...subscription,
          plan: dbState.plans.get(subscription.planId) ?? null,
        };
      },
    ),
    create: vi.fn(
      async ({
        data,
        include,
      }: {
        data: {
          storeId: string;
          planId: string;
          status: SubscriptionStatus;
          currentPeriodStart: Date;
          currentPeriodEnd: Date;
          trialEndsAt?: Date | null;
        };
        include?: { plan?: boolean };
      }) => {
        if (dbState.subscriptions.has(data.storeId)) {
          throw new Prisma.PrismaClientKnownRequestError(
            "Unique constraint failed",
            {
              code: "P2002",
              clientVersion: "test",
            },
          );
        }

        const subscription: MockSubscription = {
          id: crypto.randomUUID(),
          storeId: data.storeId,
          planId: data.planId,
          status: data.status,
          currentPeriodStart: data.currentPeriodStart,
          currentPeriodEnd: data.currentPeriodEnd,
          trialEndsAt: data.trialEndsAt ?? null,
          endedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        dbState.subscriptions.set(subscription.storeId, subscription);

        if (!include?.plan) {
          return subscription;
        }

        return {
          ...subscription,
          plan: dbState.plans.get(subscription.planId) ?? null,
        };
      },
    ),
    update: vi.fn(
      async ({
        where,
        data,
        include,
      }: {
        where: { storeId?: string; id?: string };
        data: Partial<MockSubscription>;
        include?: { plan?: boolean };
      }) => {
        let subscription: MockSubscription | null = null;

        if (where.storeId) {
          subscription = dbState.subscriptions.get(where.storeId) ?? null;
        } else if (where.id) {
          subscription =
            [...dbState.subscriptions.values()].find((row) => row.id === where.id) ??
            null;
        }

        if (!subscription) {
          throw new Error("Subscription not found");
        }

        Object.assign(subscription, data, { updatedAt: new Date() });
        dbState.subscriptions.set(subscription.storeId, subscription);

        if (!include?.plan) {
          return subscription;
        }

        return {
          ...subscription,
          plan: dbState.plans.get(subscription.planId) ?? null,
        };
      },
    ),
    deleteMany: vi.fn(async ({ where }: { where: { storeId?: string } }) => {
      let count = 0;

      for (const [key, subscription] of dbState.subscriptions.entries()) {
        if (where.storeId && subscription.storeId !== where.storeId) {
          continue;
        }

        dbState.subscriptions.delete(key);
        count += 1;
      }

      return { count };
    }),
  },
  usageRecord: {
    findMany: vi.fn(
      async ({
        where,
      }: {
        where?: { storeId?: string; month?: string };
      }) =>
        [...dbState.usageRecords.values()].filter((record) => {
          if (where?.storeId && record.storeId !== where.storeId) {
            return false;
          }

          if (where?.month && record.month !== where.month) {
            return false;
          }

          return true;
        }),
    ),
    findUnique: vi.fn(
      async ({
        where,
      }: {
        where: {
          storeId_metric_month: {
            storeId: string;
            metric: UsageMetric;
            month: string;
          };
        };
      }) => {
        const key = usageRecordKey(
          where.storeId_metric_month.storeId,
          where.storeId_metric_month.metric,
          where.storeId_metric_month.month,
        );

        return dbState.usageRecords.get(key) ?? null;
      },
    ),
    create: vi.fn(
      async ({
        data,
      }: {
        data: {
          storeId: string;
          metric: UsageMetric;
          month: string;
          value: number;
        };
      }) => {
        const key = usageRecordKey(data.storeId, data.metric, data.month);

        if (dbState.usageRecords.has(key)) {
          throw new Error("Unique constraint failed");
        }

        const record: MockUsageRecord = {
          id: crypto.randomUUID(),
          storeId: data.storeId,
          metric: data.metric,
          month: data.month,
          value: data.value,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        dbState.usageRecords.set(key, record);
        return record;
      },
    ),
    update: vi.fn(
      async ({
        where,
        data,
      }: {
        where: {
          storeId_metric_month: {
            storeId: string;
            metric: UsageMetric;
            month: string;
          };
        };
        data: {
          value: { increment: number };
        };
      }) => {
        const key = usageRecordKey(
          where.storeId_metric_month.storeId,
          where.storeId_metric_month.metric,
          where.storeId_metric_month.month,
        );
        const existing = dbState.usageRecords.get(key);

        if (!existing) {
          throw new Error(`Usage record not found: ${key}`);
        }

        const updated: MockUsageRecord = {
          ...existing,
          value: existing.value + data.value.increment,
          updatedAt: new Date(),
        };
        dbState.usageRecords.set(key, updated);
        return updated;
      },
    ),
    upsert: vi.fn(
      async ({
        where,
        create,
        update,
      }: {
        where: {
          storeId_metric_month: {
            storeId: string;
            metric: UsageMetric;
            month: string;
          };
        };
        create: {
          storeId: string;
          metric: UsageMetric;
          month: string;
          value: number;
        };
        update: {
          value: { increment: number };
        };
      }) => {
        const key = usageRecordKey(
          where.storeId_metric_month.storeId,
          where.storeId_metric_month.metric,
          where.storeId_metric_month.month,
        );
        const existing = dbState.usageRecords.get(key);

        if (existing) {
          const updated: MockUsageRecord = {
            ...existing,
            value: existing.value + update.value.increment,
            updatedAt: new Date(),
          };
          dbState.usageRecords.set(key, updated);
          return updated;
        }

        const record: MockUsageRecord = {
          id: crypto.randomUUID(),
          storeId: create.storeId,
          metric: create.metric,
          month: create.month,
          value: create.value,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        dbState.usageRecords.set(key, record);
        return record;
      },
    ),
    deleteMany: vi.fn(async ({ where }: { where: { storeId?: string } }) => {
      let count = 0;

      for (const [key, record] of dbState.usageRecords.entries()) {
        if (where.storeId && record.storeId !== where.storeId) {
          continue;
        }

        dbState.usageRecords.delete(key);
        count += 1;
      }

      return { count };
    }),
  },
  aiRecommendation: {
    findMany: vi.fn(async () => []),
    findFirst: vi.fn(async () => null),
    count: vi.fn(async () => 0),
    deleteMany: vi.fn(async () => ({ count: 0 })),
    upsert: vi.fn(
      async ({
        create,
      }: {
        create: Record<string, unknown>;
      }) => ({
        id: crypto.randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
        ...create,
      }),
    ),
    update: vi.fn(
      async ({
        data,
      }: {
        data: Record<string, unknown>;
      }) => ({
        id: crypto.randomUUID(),
        updatedAt: new Date(),
        ...data,
      }),
    ),
  },
  aiAgentResult: {
    findFirst: vi.fn(async () => null),
    findMany: vi.fn(async () => []),
    deleteMany: vi.fn(async () => ({ count: 0 })),
  },
  aiAgentRun: {
    findFirst: vi.fn(async () => null),
    findMany: vi.fn(async () => []),
    count: vi.fn(async () => 0),
    deleteMany: vi.fn(async () => ({ count: 0 })),
    aggregate: vi.fn(async () => ({
      _avg: { latencyMs: null },
      _sum: { estimatedCostUsd: null },
      _count: { _all: 0 },
    })),
  },
  aiMemoryRecord: {
    findMany: vi.fn(async () => []),
    deleteMany: vi.fn(async () => ({ count: 0 })),
    upsert: vi.fn(async ({ create }: { create: Record<string, unknown> }) => ({
      id: crypto.randomUUID(),
      ...create,
    })),
  },
  aiResultCacheEntry: {
    findUnique: vi.fn(async () => null),
    deleteMany: vi.fn(async () => ({ count: 0 })),
    upsert: vi.fn(async ({ create }: { create: Record<string, unknown> }) => ({
      id: crypto.randomUUID(),
      ...create,
    })),
  },
  user: {
    deleteMany: vi.fn(async ({ where }: { where: { storeId?: string } }) => {
      const before = dbState.users.length;
      dbState.users = dbState.users.filter(
        (user) => user.storeId !== where.storeId,
      );
      return { count: before - dbState.users.length };
    }),
  },
  session: {
    deleteMany: vi.fn(async ({ where }: { where: { shop?: string } }) => {
      const before = dbState.sessions.length;
      dbState.sessions = dbState.sessions.filter(
        (session) => session.shop !== where.shop,
      );
      return { count: before - dbState.sessions.length };
    }),
  },
  $queryRaw: vi.fn(
    async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join(" ");
      if (sql.includes("FOR UPDATE SKIP LOCKED")) {
        const claimedAt = values[0] as Date;
        const workerId = values[1] as string;
        const lockExpiresAt = values[2] as Date;
        return mockClaimNextJob(
          workerId,
          claimedAt,
          lockExpiresAt,
          dbState.syncJobs,
        );
      }

      if (sql.includes("usage_records") && sql.includes("FOR UPDATE")) {
        const storeId = values[0] as string;
        const month = values[1] as string;
        const rows: Array<{ metric: UsageMetric; value: number }> = [];

        for (const metric of ["ai_requests", "reports_generated"] as const) {
          const key = usageRecordKey(storeId, metric, month);
          const existing = dbState.usageRecords.get(key);
          if (existing) {
            rows.push({ metric, value: existing.value });
          }
        }

        return rows;
      }

      if (sql.includes("FROM stores") && sql.includes("FOR UPDATE")) {
        const storeId = values[0] as string;
        return [{ id: storeId }];
      }

      if (sql.includes("FROM subscriptions") && sql.includes("FOR UPDATE")) {
        const storeId = values[0] as string;
        return [{ id: storeId }];
      }

      if (sql.includes("_prisma_migrations")) {
        return expectedMigrationRows();
      }

      throw new Error(`Unexpected $queryRaw SQL: ${sql}`);
    },
  ),
  $transaction: vi.fn(
    async (
      callback: (tx: typeof prismaMock) => Promise<unknown>,
      _options?: unknown,
    ) => {
      const run = async () => {
        const snapshot = {
          products: new Map(dbState.products),
          orders: new Map(dbState.orders),
          orderLineItems: new Map(dbState.orderLineItems),
          webhookEvents: new Map(dbState.webhookEvents),
          webhookEventsById: new Map(dbState.webhookEventsById),
          syncJobs: new Map(dbState.syncJobs),
          syncJobsByIdempotency: new Map(dbState.syncJobsByIdempotency),
          jobEvents: [...dbState.jobEvents],
          storeOnboarding: new Map(dbState.storeOnboarding),
          plans: new Map(dbState.plans),
          plansBySlug: new Map(dbState.plansBySlug),
          subscriptions: new Map(dbState.subscriptions),
          usageRecords: new Map(dbState.usageRecords),
          sessions: [...dbState.sessions],
          users: [...dbState.users],
          stores: structuredClone(dbState.stores),
        };

        try {
          const tx = Object.assign(
            { __transactionClient: true as const },
            prismaMock,
          );
          return await callback(tx);
        } catch (error) {
          dbState.products = snapshot.products;
          dbState.orders = snapshot.orders;
          dbState.orderLineItems = snapshot.orderLineItems;
          dbState.webhookEvents = snapshot.webhookEvents;
          dbState.webhookEventsById = snapshot.webhookEventsById;
          dbState.syncJobs = snapshot.syncJobs;
          dbState.syncJobsByIdempotency = snapshot.syncJobsByIdempotency;
          dbState.jobEvents = snapshot.jobEvents;
          dbState.storeOnboarding = snapshot.storeOnboarding;
          dbState.plans = snapshot.plans;
          dbState.plansBySlug = snapshot.plansBySlug;
          dbState.subscriptions = snapshot.subscriptions;
          dbState.usageRecords = snapshot.usageRecords;
          dbState.sessions = snapshot.sessions;
          dbState.users = snapshot.users;
          dbState.stores = snapshot.stores;
          throw error;
        }
      };

      const result = transactionChain.current.then(run, run);
      transactionChain.current = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    },
  ),
}));

vi.mock("../../../db.server", () => ({
  default: prismaMock,
}));

vi.mock("../../../shopify.server", () => ({
  unauthenticated: {
    admin: vi.fn(async () => ({
      admin: {
        graphql: mockAdminGraphql,
      },
    })),
  },
  apiVersionString: "2025-10",
}));

declare global {
  // eslint-disable-next-line no-var
  var __D7_TEST__: {
    dbState: typeof dbState;
    mockAdminGraphql: typeof mockAdminGraphql;
    prismaMock: typeof prismaMock;
    resetDbState: () => void;
    seedProduct: (
      overrides: Partial<MockProduct> & Pick<MockProduct, "shopifyVariantId">,
    ) => MockProduct;
    getProduct: (shopifyVariantId: string) => MockProduct | undefined;
    seedOrder: (
      overrides: Partial<MockOrder> & Pick<MockOrder, "shopifyOrderId">,
    ) => MockOrder;
    seedOrderLineItem: (
      overrides: Partial<MockOrderLineItem> &
        Pick<MockOrderLineItem, "shopifyLineItemId" | "orderId">,
    ) => MockOrderLineItem;
    getOrder: (shopifyOrderId: string) => MockOrder | undefined;
    getOrderLineItems: (orderId: string) => MockOrderLineItem[];
    getStore: () => (typeof dbState.stores)[number];
    getJobEvents: (jobId: string) => MockJobEvent[];
    seedSyncJob: (
      overrides: Partial<MockSyncJob> &
        Pick<MockSyncJob, "idempotencyKey" | "jobType">,
    ) => MockSyncJob;
    getOnboarding: (storeId?: string) => MockStoreOnboarding | undefined;
  };
}

globalThis.__D7_TEST__ = {
  dbState,
  mockAdminGraphql,
  prismaMock,
  resetDbState: () => {
    transactionChain.current = Promise.resolve();
    dbState.products.clear();
    dbState.orders.clear();
    dbState.orderLineItems.clear();
    dbState.webhookEvents.clear();
    dbState.webhookEventsById.clear();
    dbState.syncJobs.clear();
    dbState.syncJobsByIdempotency.clear();
    dbState.jobEvents.length = 0;
    dbState.storeOnboarding.clear();
    dbState.usageRecords.clear();
    dbState.subscriptions.clear();
    dbState.customerDataExports.clear();
    dbState.customerDataExportsByWebhook.clear();
    dbState.googleIntegrations.clear();
    dbState.microsoftClarityIntegrations.clear();
    dbState.sessions.length = 0;
    dbState.users.length = 0;
    seedDefaultPlans(dbState);
    dbState.stores.length = 0;
    dbState.stores.push({
      id: "store-test-001",
      shopifyDomain: "storepilot-test.myshopify.com",
      active: true,
      currency: "USD",
      accessToken: "test-access-token",
      ga4RefreshToken: "test-ga4-refresh-token",
      ga4PropertyId: "properties/123456",
      lastAuthenticatedAt: null,
      firstTrialStartedAt: null,
      lastProductsSyncAt: null,
      lastInventorySyncAt: null,
      historicalOrdersImportDone: false,
      lastOrdersSyncAt: null,
      ordersSyncCursor: null,
    });
    seedDefaultSubscription(dbState);
  },
  seedProduct: (overrides) => {
    const product: MockProduct = {
      id: overrides.id ?? crypto.randomUUID(),
      storeId: overrides.storeId ?? "store-test-001",
      shopifyProductId:
        overrides.shopifyProductId ?? "gid://shopify/Product/789",
      shopifyVariantId: overrides.shopifyVariantId,
      shopifyInventoryItemId:
        overrides.shopifyInventoryItemId ?? "gid://shopify/InventoryItem/123",
      title: overrides.title ?? "Test Product",
      sku: overrides.sku ?? "SKU-1",
      status: overrides.status ?? "active",
      price: overrides.price ?? null,
      inventoryQuantity:
        overrides.inventoryQuantity === undefined
          ? 11
          : overrides.inventoryQuantity,
      inventoryTracked:
        overrides.inventoryTracked === undefined
          ? true
          : overrides.inventoryTracked,
      shopifyProductUpdatedAt:
        overrides.shopifyProductUpdatedAt === undefined
          ? null
          : overrides.shopifyProductUpdatedAt,
      createdAt: overrides.createdAt ?? new Date(),
      updatedAt: overrides.updatedAt ?? new Date(),
    };

    dbState.products.set(
      productKey(product.storeId, product.shopifyVariantId),
      product,
    );
    return product;
  },
  getProduct: (shopifyVariantId) =>
    dbState.products.get(
      productKey("store-test-001", shopifyVariantId),
    ),
  seedOrder: (overrides) => {
    const order: MockOrder = {
      id: overrides.id ?? crypto.randomUUID(),
      storeId: overrides.storeId ?? "store-test-001",
      shopifyOrderId: overrides.shopifyOrderId,
      orderName: overrides.orderName ?? "#1001",
      shopifyCreatedAt: overrides.shopifyCreatedAt ?? new Date("2026-01-15T10:00:00Z"),
      shopifyUpdatedAt: overrides.shopifyUpdatedAt ?? new Date("2026-01-15T10:00:00Z"),
      processedAt: overrides.processedAt ?? new Date("2026-01-15T10:00:00Z"),
      cancelledAt: overrides.cancelledAt ?? null,
      metricDate: overrides.metricDate ?? new Date("2026-01-15T00:00:00Z"),
      displayFinancialStatus: overrides.displayFinancialStatus ?? "paid",
      currencyCode: overrides.currencyCode ?? "USD",
      subtotalAmount: overrides.subtotalAmount ?? "100.00",
      totalTaxAmount: overrides.totalTaxAmount ?? "10.00",
      totalDiscountAmount: overrides.totalDiscountAmount ?? "5.00",
      totalPriceAmount: overrides.totalPriceAmount ?? "105.00",
      totalRefundedAmount: overrides.totalRefundedAmount ?? "0",
      isTest: overrides.isTest ?? false,
      isPaid: overrides.isPaid ?? true,
      createdAt: overrides.createdAt ?? new Date(),
      updatedAt: overrides.updatedAt ?? new Date(),
    };

    dbState.orders.set(orderKey(order.storeId, order.shopifyOrderId), order);
    return order;
  },
  seedOrderLineItem: (overrides) => {
    const lineItem: MockOrderLineItem = {
      id: overrides.id ?? crypto.randomUUID(),
      storeId: overrides.storeId ?? "store-test-001",
      orderId: overrides.orderId,
      shopifyLineItemId: overrides.shopifyLineItemId,
      shopifyOrderId: overrides.shopifyOrderId ?? "gid://shopify/Order/1001",
      shopifyProductId: overrides.shopifyProductId ?? null,
      shopifyVariantId: overrides.shopifyVariantId ?? null,
      sku: overrides.sku ?? null,
      title: overrides.title ?? "Line Item",
      quantity: overrides.quantity ?? 1,
      originalUnitPrice: overrides.originalUnitPrice ?? "10.00",
      discountedUnitPrice: overrides.discountedUnitPrice ?? "10.00",
      isGiftCard: overrides.isGiftCard ?? false,
      createdAt: overrides.createdAt ?? new Date(),
      updatedAt: overrides.updatedAt ?? new Date(),
    };

    dbState.orderLineItems.set(
      orderLineItemKey(lineItem.storeId, lineItem.shopifyLineItemId),
      lineItem,
    );
    return lineItem;
  },
  getOrder: (shopifyOrderId) =>
    dbState.orders.get(orderKey("store-test-001", shopifyOrderId)),
  getOrderLineItems: (orderId) =>
    [...dbState.orderLineItems.values()].filter(
      (lineItem) => lineItem.orderId === orderId,
    ),
  getStore: () => dbState.stores[0]!,
  getJobEvents: (jobId) =>
    dbState.jobEvents.filter((event) => event.jobId === jobId),
  seedSyncJob: (overrides) => {
    const job: MockSyncJob = {
      id: overrides.id ?? crypto.randomUUID(),
      storeId: overrides.storeId ?? "store-test-001",
      jobType: overrides.jobType,
      status: overrides.status ?? "queued",
      priority: overrides.priority ?? "normal",
      payload: overrides.payload ?? {},
      cursorJson: overrides.cursorJson ?? null,
      progressJson: overrides.progressJson ?? null,
      attempts: overrides.attempts ?? 0,
      maxAttempts: overrides.maxAttempts ?? 3,
      availableAt: overrides.availableAt ?? new Date(),
      startedAt: overrides.startedAt ?? null,
      completedAt: overrides.completedAt ?? null,
      failedAt: overrides.failedAt ?? null,
      deadLetterAt: overrides.deadLetterAt ?? null,
      cancelledAt: overrides.cancelledAt ?? null,
      errorCode: overrides.errorCode ?? null,
      errorMessage: overrides.errorMessage ?? null,
      idempotencyKey: overrides.idempotencyKey,
      lockedBy: overrides.lockedBy ?? null,
      lockedAt: overrides.lockedAt ?? null,
      lockExpiresAt: overrides.lockExpiresAt ?? null,
      heartbeatAt: overrides.heartbeatAt ?? null,
      durationMs: overrides.durationMs ?? null,
      workerGeneration: overrides.workerGeneration ?? 0,
      createdAt: overrides.createdAt ?? new Date(),
      updatedAt: overrides.updatedAt ?? new Date(),
    };

    dbState.syncJobs.set(job.id, job);
    dbState.syncJobsByIdempotency.set(job.idempotencyKey, job.id);
    return job;
  },
  getOnboarding: (storeId = "store-test-001") =>
    dbState.storeOnboarding.get(storeId),
};
