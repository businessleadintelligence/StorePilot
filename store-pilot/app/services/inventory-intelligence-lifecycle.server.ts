import type { InventoryFacts } from "../ai/facts/inventory-facts";
import type { AIPersistenceRepositories } from "../ai/persistence/types";
import {
  getInventoryRecommendationExpirationReason,
  shouldExpireInventoryRecommendation,
} from "../ai/agents/inventory-intelligence-expiration";

export type InventoryRecommendationLifecycleEvent = {
  stableId: string;
  recommendationId: string;
  fromStatus: string;
  toStatus: string;
  reason: string;
  at: string;
};

function readTimeline(payload: Record<string, unknown>) {
  return (payload.timeline as Record<string, unknown> | undefined) ?? {};
}

function withTimeline(payload: Record<string, unknown>, patch: Record<string, unknown>) {
  return {
    ...payload,
    timeline: {
      ...readTimeline(payload),
      ...patch,
    },
  };
}

function verificationSucceeded(input: {
  facts: InventoryFacts;
  payload: Record<string, unknown>;
}): boolean {
  const verification = input.payload.verification as
    | { expectedMetric?: string; expectedDirection?: string }
    | undefined;

  if (!verification?.expectedMetric) {
    return false;
  }

  if (verification.expectedMetric === "Inventory Days") {
    return input.facts.averageDaysRemaining !== null && input.facts.averageDaysRemaining >= 14;
  }

  if (verification.expectedMetric === "Dead stock units") {
    return input.facts.deadStockCount === 0;
  }

  if (verification.expectedMetric === "Inventory coverage") {
    return input.facts.overstockCount === 0;
  }

  if (verification.expectedMetric === "Inventory health score") {
    const baseline = Number(input.payload.baselineInventoryHealthScore ?? 0);
    return baseline > 0
      ? input.facts.inventoryHealthScore > baseline
      : input.facts.inventoryHealthScore >= 70;
  }

  return input.facts.inventoryHealthScore >= 70;
}

export async function processInventoryIntelligenceLifecycle(input: {
  storeId: string;
  subjectKey: string;
  facts: InventoryFacts;
  persistence: AIPersistenceRepositories;
  now?: Date;
}): Promise<InventoryRecommendationLifecycleEvent[]> {
  const events: InventoryRecommendationLifecycleEvent[] = [];
  const now = (input.now ?? new Date()).toISOString();
  const records = await input.persistence.recommendations.listBySubject({
    storeId: input.storeId,
    subjectKey: input.subjectKey,
  });

  for (const record of records) {
    const recommendationId = String(record.payloadJson.id ?? record.stableId);

    if (
      shouldExpireInventoryRecommendation({
        facts: input.facts,
        payload: record.payloadJson,
        status: record.status,
      })
    ) {
      const reason = getInventoryRecommendationExpirationReason({
        facts: input.facts,
        payload: record.payloadJson,
      });

      await input.persistence.recommendations.updateStatus({
        storeId: input.storeId,
        stableId: record.stableId,
        status: "closed",
      });

      events.push({
        stableId: record.stableId,
        recommendationId,
        fromStatus: record.status,
        toStatus: "closed",
        reason: reason ?? "issue_resolved",
        at: now,
      });
      continue;
    }

    if (record.status === "implemented") {
      const verifyingPayload = withTimeline(record.payloadJson, {
        verifying: readTimeline(record.payloadJson).verifying ?? now,
      });

      if (verificationSucceeded({ facts: input.facts, payload: record.payloadJson })) {
        await input.persistence.recommendations.updateStatus({
          storeId: input.storeId,
          stableId: record.stableId,
          status: "verified",
        });

        await input.persistence.recommendations.upsertMany([
          {
            ...record,
            status: "verified",
            payloadJson: withTimeline(verifyingPayload, { verified: now }),
          },
        ]);

        events.push({
          stableId: record.stableId,
          recommendationId,
          fromStatus: record.status,
          toStatus: "verified",
          reason: "verification_succeeded",
          at: now,
        });
      }
    }
  }

  return events;
}

export async function recordInventoryMerchantRecommendationFeedback(input: {
  storeId: string;
  subjectKey: string;
  stableId: string;
  feedback: "implement" | "dismiss" | "ignore" | "snooze";
  persistence: AIPersistenceRepositories;
  snoozedUntil?: string;
}): Promise<void> {
  const records = await input.persistence.recommendations.listBySubject({
    storeId: input.storeId,
    subjectKey: input.subjectKey,
  });
  const record = records.find((item) => item.stableId === input.stableId);

  if (!record) {
    throw new Error("recommendation_not_found");
  }

  const now = new Date().toISOString();
  const payload = {
    ...record.payloadJson,
    feedback: input.feedback,
    snoozedUntil: input.snoozedUntil ?? null,
    timeline: {
      ...readTimeline(record.payloadJson),
      ...(input.feedback === "implement" ? { implemented: now, verifying: now } : {}),
    },
  };

  const status =
    input.feedback === "implement"
      ? "implemented"
      : input.feedback === "dismiss"
        ? "dismissed"
        : record.status;

  await input.persistence.recommendations.updateStatus({
    storeId: input.storeId,
    stableId: input.stableId,
    status,
  });

  await input.persistence.recommendations.upsertMany([
    {
      ...record,
      status,
      payloadJson: payload,
    },
  ]);
}
