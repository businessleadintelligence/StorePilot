import type { ProductFacts } from "../ai/facts/product-facts";
import type { AIPersistenceRepositories } from "../ai/persistence/types";
import {
  getRecommendationExpirationReason,
  shouldExpireRecommendation,
} from "../ai/agents/product-intelligence-expiration";

export type RecommendationLifecycleEvent = {
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
  facts: ProductFacts;
  payload: Record<string, unknown>;
}): boolean {
  const verification = input.payload.verification as
    | { expectedMetric?: string; expectedDirection?: string }
    | undefined;

  if (!verification?.expectedMetric) {
    return false;
  }

  if (verification.expectedMetric === "Inventory Days") {
    if (verification.expectedDirection === "Increase") {
      return input.facts.daysRemaining !== null && input.facts.daysRemaining >= 14;
    }

    return input.facts.daysRemaining !== null && input.facts.daysRemaining <= 60;
  }

  if (verification.expectedMetric === "30 day revenue") {
    return input.facts.trend === "growing" && input.facts.sales7Days > 0;
  }

  if (verification.expectedMetric === "Margin") {
    return input.facts.margin !== null && input.facts.margin >= 20;
  }

  if (verification.expectedMetric === "Product health score") {
    const baseline = Number(input.payload.baselineHealthScore ?? 0);
    return baseline > 0
      ? input.facts.healthScore > baseline
      : input.facts.healthScore >= 70;
  }

  return input.facts.healthScore >= 70;
}

export async function processProductIntelligenceLifecycle(input: {
  storeId: string;
  subjectKey: string;
  facts: ProductFacts;
  persistence: AIPersistenceRepositories;
  now?: Date;
}): Promise<RecommendationLifecycleEvent[]> {
  const events: RecommendationLifecycleEvent[] = [];
  const now = (input.now ?? new Date()).toISOString();
  const records = await input.persistence.recommendations.listBySubject({
    storeId: input.storeId,
    subjectKey: input.subjectKey,
  });

  for (const record of records) {
    const recommendationId = String(record.payloadJson.id ?? record.stableId);

    if (shouldExpireRecommendation({
      facts: input.facts,
      payload: record.payloadJson,
      status: record.status,
    })) {
      const reason = getRecommendationExpirationReason({
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

        events.push({
          stableId: record.stableId,
          recommendationId,
          fromStatus: "implemented",
          toStatus: "verified",
          reason: "metrics_improved",
          at: now,
        });
        continue;
      }

      if (!readTimeline(record.payloadJson).verifying) {
        await input.persistence.recommendations.upsertMany([
          {
            ...record,
            payloadJson: verifyingPayload,
            status: record.status,
          },
        ]);

        events.push({
          stableId: record.stableId,
          recommendationId,
          fromStatus: "implemented",
          toStatus: "implemented",
          reason: "verifying",
          at: now,
        });
      }
    }
  }

  return events;
}

export async function recordMerchantRecommendationFeedback(input: {
  storeId: string;
  subjectKey: string;
  stableId: string;
  feedback: "dismiss" | "implement" | "ignore" | "snooze";
  persistence: AIPersistenceRepositories;
  snoozedUntil?: string;
  baselineHealthScore?: number;
}) {
  const records = await input.persistence.recommendations.listBySubject({
    storeId: input.storeId,
    subjectKey: input.subjectKey,
  });
  const record = records.find((entry) => entry.stableId === input.stableId);
  if (!record) {
    return null;
  }

  const statusMap = {
    dismiss: "dismissed",
    implement: "implemented",
    ignore: "dismissed",
    snooze: "dismissed",
  } as const;

  const nextStatus = statusMap[input.feedback];
  await input.persistence.recommendations.updateStatus({
    storeId: input.storeId,
    stableId: input.stableId,
    status: nextStatus,
  });

  await input.persistence.recommendations.upsertMany([
    {
      ...record,
      status: nextStatus,
      payloadJson: {
        ...record.payloadJson,
        feedback: input.feedback,
        snoozedUntil: input.snoozedUntil ?? null,
        baselineHealthScore:
          input.baselineHealthScore ??
          (typeof record.payloadJson.baselineHealthScore === "number"
            ? record.payloadJson.baselineHealthScore
            : null),
      },
    },
  ]);

  return record;
}
