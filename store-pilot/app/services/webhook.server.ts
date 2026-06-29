import { Prisma } from "@prisma/client";

import { createSafeLogger } from "../lib/safe-log.server";
import prisma from "../db.server";

const webhookLogger = createSafeLogger("[webhook-event]");

type LogLevel = "info" | "warn" | "error";

const WEBHOOK_PROCESSING_LEASE_MS = 5 * 60 * 1000;

export type WebhookLeaseStatus = "claimed" | "duplicate" | "lease_active" | "lease_expired";

export type WebhookEventLogContext = {
  shop: string;
  storeId?: string;
  topic?: string;
  webhookId?: string;
  operation:
    | "webhook_claimed"
    | "webhook_duplicate"
    | "webhook_processed"
    | "webhook_process_failed";
  reason?: string;
  leaseStatus?: WebhookLeaseStatus;
};

export type ClaimWebhookEventInput = {
  storeId: string;
  shop: string;
  topic: string;
  webhookId: string;
};

export type ClaimWebhookEventResult = {
  status: WebhookLeaseStatus;
  eventId?: string;
  processingOwner?: string;
  retryable?: boolean;
  reason?: string;
};

export class WebhookLeaseOwnershipError extends Error {
  readonly eventId: string;
  readonly expectedOwner: string;

  constructor(input: { eventId: string; expectedOwner: string }) {
    super("webhook_lease_ownership_mismatch");
    this.name = "WebhookLeaseOwnershipError";
    this.eventId = input.eventId;
    this.expectedOwner = input.expectedOwner;
  }
}

export type WebhookSkipDisposition = "permanent" | "retriable";

export function classifyOrderWebhookSkip(
  reason: string,
): WebhookSkipDisposition {
  if (reason === "order_not_found" || reason === "limit_exceeded") {
    return "retriable";
  }

  return "permanent";
}

export function classifyInventoryWebhookSkip(
  reason: string,
): WebhookSkipDisposition {
  if (
    reason === "variant_not_found" ||
    reason === "inventory_item_not_found_in_graphql" ||
    reason === "inventory_quantity_not_updated"
  ) {
    return "retriable";
  }

  return "permanent";
}

export function classifyProductWebhookSkip(
  reason: string,
): WebhookSkipDisposition {
  if (reason === "product_not_found" || reason === "graphql_fetch_failed") {
    return "retriable";
  }

  return "permanent";
}

export function isClaimDuplicate(result: ClaimWebhookEventResult): boolean {
  return result.status === "duplicate";
}

export function isClaimRetryable(result: ClaimWebhookEventResult): boolean {
  return result.retryable === true;
}

export async function finalizeWebhookClaim(
  eventId: string | undefined,
  markProcessed: boolean,
  processingOwner?: string,
): Promise<void> {
  if (!eventId) {
    return;
  }

  if (markProcessed) {
    if (!processingOwner) {
      throw new WebhookLeaseOwnershipError({
        eventId,
        expectedOwner: "missing",
      });
    }

    await markWebhookEventProcessed(eventId, processingOwner);
    return;
  }

  if (processingOwner) {
    await releaseWebhookProcessingLease(eventId, processingOwner);
  }
}

export async function releaseWebhookProcessingLease(
  eventId: string,
  processingOwner: string,
): Promise<void> {
  await prisma.webhookEvent.updateMany({
    where: {
      id: eventId,
      processedSuccessfully: false,
      processingOwner,
    },
    data: {
      processingOwner: null,
      processingExpiresAt: null,
    },
  });
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export function logWebhookEvent(
  level: LogLevel,
  message: string,
  context: WebhookEventLogContext,
): void {
  const payload = { message, ...context };

  if (level === "error") {
    webhookLogger.error(message, payload);
    return;
  }

  if (level === "warn") {
    webhookLogger.warn(message, payload);
    return;
  }

  webhookLogger.info(message, payload);
}

export type StoreWebhookLookup = {
  storeId: string;
  active: boolean;
};

export type WebhookGateOutcome =
  | { outcome: "retryable"; reason: "store_not_found" }
  | { outcome: "duplicate" }
  | { outcome: "inactive_retry"; storeId: string; retryable: true }
  | { outcome: "lease_retry"; storeId: string; eventId?: string; retryable: true; reason: string }
  | {
      outcome: "ready";
      storeId: string;
      eventId?: string;
      processingOwner: string;
    };

export type RetryableWebhookHandlerResult = {
  retryable?: boolean;
  reason?: string;
};

export async function lookupStoreForWebhook(
  shop: string,
): Promise<StoreWebhookLookup | null> {
  const store = await prisma.store.findUnique({
    where: { shopifyDomain: shop },
    select: { id: true, active: true },
  });

  if (!store) {
    return null;
  }

  return {
    storeId: store.id,
    active: store.active,
  };
}

export async function gateWebhookEvent(input: {
  shop: string;
  topic: string;
  webhookId: string;
  lookup: StoreWebhookLookup;
}): Promise<WebhookGateOutcome> {
  if (!input.lookup.active) {
    logWebhookEvent("info", "Inactive store webhook deferred for Shopify retry", {
      shop: input.shop,
      storeId: input.lookup.storeId,
      topic: input.topic,
      webhookId: input.webhookId,
      operation: "webhook_process_failed",
      reason: "store_inactive_retry",
    });

    return {
      outcome: "inactive_retry",
      storeId: input.lookup.storeId,
      retryable: true,
    };
  }

  const claim = await claimWebhookEvent({
    storeId: input.lookup.storeId,
    shop: input.shop,
    topic: input.topic,
    webhookId: input.webhookId,
  });

  if (claim.status === "duplicate") {
    return { outcome: "duplicate" };
  }

  if (claim.retryable) {
    logWebhookEvent("info", "Webhook delivery deferred for retry", {
      shop: input.shop,
      storeId: input.lookup.storeId,
      topic: input.topic,
      webhookId: input.webhookId,
      operation: "webhook_process_failed",
      reason: claim.reason ?? claim.status,
      leaseStatus: claim.status,
    });

    return {
      outcome: "lease_retry",
      storeId: input.lookup.storeId,
      eventId: claim.eventId,
      retryable: true,
      reason: claim.reason ?? claim.status,
    };
  }

  if (!claim.processingOwner) {
    throw new Error("webhook_claim_missing_processing_owner");
  }

  return {
    outcome: "ready",
    storeId: input.lookup.storeId,
    eventId: claim.eventId,
    processingOwner: claim.processingOwner,
  };
}

export function buildWebhookActionResponse(
  result: RetryableWebhookHandlerResult,
): Response {
  if (result.retryable) {
    return new Response(undefined, { status: 503 });
  }

  return new Response();
}

const PERMANENT_WEBHOOK_ERROR_CODES = new Set([
  "missing_customer",
  "missing_customer_id",
  "missing_shop_domain",
  "access_denied",
  "insufficient_scope",
  "protected_customer_data",
]);

export function isRetriableWebhookError(error: unknown): boolean {
  if (error instanceof Response) {
    return false;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  if (error.message.startsWith("retriable_")) {
    return true;
  }

  return !PERMANENT_WEBHOOK_ERROR_CODES.has(error.message);
}

export function buildWebhookCatchResponse(error: unknown): Response {
  if (error instanceof Response) {
    return error;
  }

  if (isRetriableWebhookError(error)) {
    return new Response(undefined, { status: 503 });
  }

  return new Response(undefined, { status: 500 });
}

export async function isDuplicateWebhook(webhookId: string): Promise<boolean> {
  const existing = await prisma.webhookEvent.findUnique({
    where: { shopifyWebhookId: webhookId },
    select: { processedSuccessfully: true },
  });

  return existing?.processedSuccessfully === true;
}

type LeaseAcquireResult =
  | { acquired: true; ownerId: string }
  | { acquired: false; expired: boolean };

async function acquireWebhookProcessingLease(
  eventId: string,
): Promise<LeaseAcquireResult> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + WEBHOOK_PROCESSING_LEASE_MS);
  const ownerId = crypto.randomUUID();

  const acquired = await prisma.webhookEvent.updateMany({
    where: {
      id: eventId,
      processedSuccessfully: false,
      OR: [
        { processingOwner: null },
        { processingExpiresAt: null },
        { processingExpiresAt: { lt: now } },
      ],
    },
    data: {
      processingOwner: ownerId,
      processingExpiresAt: expiresAt,
    },
  });

  if (acquired.count > 0) {
    return { acquired: true, ownerId };
  }

  const current = await prisma.webhookEvent.findUnique({
    where: { id: eventId },
    select: { processingExpiresAt: true },
  });

  const expired =
    !current?.processingExpiresAt || current.processingExpiresAt < now;

  return { acquired: false, expired };
}

export async function claimWebhookEvent(
  input: ClaimWebhookEventInput,
): Promise<ClaimWebhookEventResult> {
  const existing = await prisma.webhookEvent.findUnique({
    where: { shopifyWebhookId: input.webhookId },
    select: { id: true, processedSuccessfully: true },
  });

  if (existing?.processedSuccessfully) {
    logWebhookEvent("info", "Duplicate webhook delivery skipped", {
      shop: input.shop,
      storeId: input.storeId,
      topic: input.topic,
      webhookId: input.webhookId,
      operation: "webhook_duplicate",
      reason: "already_processed_successfully",
      leaseStatus: "duplicate",
    });
    return { status: "duplicate" };
  }

  let eventId = existing?.id;
  const createdNew = !eventId;

  if (!eventId) {
    try {
      const event = await prisma.webhookEvent.create({
        data: {
          storeId: input.storeId,
          shopifyWebhookId: input.webhookId,
          shop: input.shop,
          topic: input.topic,
          processedSuccessfully: false,
          processedAt: null,
        },
      });

      eventId = event.id;
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }

      const raced = await prisma.webhookEvent.findUnique({
        where: { shopifyWebhookId: input.webhookId },
        select: { id: true, processedSuccessfully: true },
      });

      if (!raced) {
        throw error;
      }

      if (raced.processedSuccessfully) {
        logWebhookEvent("info", "Duplicate webhook delivery skipped", {
          shop: input.shop,
          storeId: input.storeId,
          topic: input.topic,
          webhookId: input.webhookId,
          operation: "webhook_duplicate",
          reason: "already_processed_successfully",
          leaseStatus: "duplicate",
        });
        return { status: "duplicate" };
      }

      eventId = raced.id;
    }
  }

  const lease = await acquireWebhookProcessingLease(eventId);

  if (!lease.acquired) {
    const status: WebhookLeaseStatus = lease.expired ? "lease_expired" : "lease_active";
    logWebhookEvent("info", "Webhook delivery deferred — lease not available", {
      shop: input.shop,
      storeId: input.storeId,
      topic: input.topic,
      webhookId: input.webhookId,
      operation: "webhook_process_failed",
      reason: status,
      leaseStatus: status,
    });
    return {
      status,
      eventId,
      retryable: true,
      reason: status,
    };
  }

  logWebhookEvent("info", "Webhook event claimed", {
    shop: input.shop,
    storeId: input.storeId,
    topic: input.topic,
    webhookId: input.webhookId,
    operation: "webhook_claimed",
    reason: createdNew ? "created" : "retry_after_incomplete",
    leaseStatus: "claimed",
  });

  return {
    status: "claimed",
    eventId,
    processingOwner: lease.ownerId,
  };
}

export async function markWebhookEventProcessed(
  eventId: string,
  processingOwner: string,
): Promise<void> {
  const finalized = await prisma.webhookEvent.updateMany({
    where: {
      id: eventId,
      processedSuccessfully: false,
      processingOwner,
    },
    data: {
      processedSuccessfully: true,
      processedAt: new Date(),
      processingOwner: null,
      processingExpiresAt: null,
    },
  });

  if (finalized.count === 0) {
    const existing = await prisma.webhookEvent.findUnique({
      where: { id: eventId },
      select: { processedSuccessfully: true, processingOwner: true },
    });

    if (!existing) {
      return;
    }

    if (existing.processedSuccessfully) {
      return;
    }

    throw new WebhookLeaseOwnershipError({
      eventId,
      expectedOwner: processingOwner,
    });
  }
}

export const WEBHOOK_PROCESSING_LEASE_MS_EXPORT = WEBHOOK_PROCESSING_LEASE_MS;
