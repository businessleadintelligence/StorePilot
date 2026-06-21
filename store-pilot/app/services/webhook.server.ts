import { Prisma } from "@prisma/client";

import prisma from "../db.server";

type LogLevel = "info" | "warn" | "error";

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
};

export type ClaimWebhookEventInput = {
  storeId: string;
  shop: string;
  topic: string;
  webhookId: string;
};

export type ClaimWebhookEventResult = {
  duplicate: boolean;
  eventId?: string;
};

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
    console.error("[webhook-event]", payload);
    return;
  }

  if (level === "warn") {
    console.warn("[webhook-event]", payload);
    return;
  }

  console.info("[webhook-event]", payload);
}

export async function isDuplicateWebhook(webhookId: string): Promise<boolean> {
  const existing = await prisma.webhookEvent.findUnique({
    where: { shopifyWebhookId: webhookId },
    select: { processedSuccessfully: true },
  });

  return existing?.processedSuccessfully === true;
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
    });
    return { duplicate: true };
  }

  if (existing && !existing.processedSuccessfully) {
    logWebhookEvent("info", "Webhook reclaim for retry", {
      shop: input.shop,
      storeId: input.storeId,
      topic: input.topic,
      webhookId: input.webhookId,
      operation: "webhook_claimed",
      reason: "retry_after_incomplete",
    });
    return { duplicate: false, eventId: existing.id };
  }

  try {
    const event = await prisma.webhookEvent.create({
      data: {
        storeId: input.storeId,
        shopifyWebhookId: input.webhookId,
        shop: input.shop,
        topic: input.topic,
        processedSuccessfully: false,
      },
    });

    logWebhookEvent("info", "Webhook event claimed", {
      shop: input.shop,
      storeId: input.storeId,
      topic: input.topic,
      webhookId: input.webhookId,
      operation: "webhook_claimed",
    });

    return { duplicate: false, eventId: event.id };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      logWebhookEvent("info", "Concurrent webhook claim treated as duplicate", {
        shop: input.shop,
        storeId: input.storeId,
        topic: input.topic,
        webhookId: input.webhookId,
        operation: "webhook_duplicate",
        reason: "unique_constraint_race",
      });
      return { duplicate: true };
    }

    throw error;
  }
}

export async function markWebhookEventProcessed(eventId: string): Promise<void> {
  await prisma.webhookEvent.update({
    where: { id: eventId },
    data: {
      processedSuccessfully: true,
      processedAt: new Date(),
    },
  });
}
