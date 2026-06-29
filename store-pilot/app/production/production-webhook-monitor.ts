import prisma from "../db.server";
import { buildSubsystemHealth, levelFromFailureCount } from "./production-checks";
import type { ProductionSubsystemHealth } from "./production-types";

export async function monitorWebhooks(storeId: string): Promise<ProductionSubsystemHealth> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [processed, failed, pending, lastEvent, duplicateTopics] = await Promise.all([
    prisma.webhookEvent.count({
      where: { storeId, processedSuccessfully: true, createdAt: { gte: since } },
    }),
    prisma.webhookEvent.count({
      where: { storeId, processedSuccessfully: false, createdAt: { gte: since } },
    }),
    prisma.webhookEvent.count({
      where: {
        storeId,
        processedSuccessfully: false,
        OR: [{ processingExpiresAt: { gt: new Date() } }, { processingExpiresAt: null }],
      },
    }),
    prisma.webhookEvent.findFirst({
      where: { storeId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, topic: true },
    }),
    prisma.webhookEvent.groupBy({
      by: ["topic"],
      where: { storeId, createdAt: { gte: since } },
      _count: { topic: true },
    }),
  ]);

  const level = levelFromFailureCount(failed, 10);

  return buildSubsystemHealth({
    id: "webhooks",
    label: "Webhook Processing",
    level,
    failureCount: failed,
    lastSync: lastEvent?.createdAt.toISOString() ?? null,
    recoverySuggestion:
      failed > 0 ? "Inspect failed webhook events and verify Shopify webhook subscriptions" : null,
    details: {
      processed24h: processed,
      failed24h: failed,
      pending,
      lastTopic: lastEvent?.topic ?? null,
      activeTopics: duplicateTopics.length,
    },
  });
}
