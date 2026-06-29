import type { PricingIntelligenceFacts } from "../ai/facts/pricing-intelligence-facts";
import type { AIPersistenceRepositories } from "../ai/persistence/types";
import {
  getPricingRecommendationExpirationReason,
  getPricingRecommendationVerificationReason,
  shouldExpirePricingRecommendation,
} from "../ai/agents/pricing-intelligence-expiration";

export type PricingRecommendationLifecycleEvent = {
  stableId: string;
  recommendationId: string;
  fromStatus: string;
  toStatus: string;
  reason: string;
  at: string;
};

function readTimeline(payload: Record<string, unknown>) {
  return (payload.recommendationTimeline as Record<string, unknown> | undefined) ?? {};
}

function withTimeline(payload: Record<string, unknown>, patch: Record<string, unknown>) {
  return {
    ...payload,
    recommendationTimeline: {
      ...readTimeline(payload),
      ...patch,
    },
  };
}

export async function processPricingIntelligenceLifecycle(input: {
  storeId: string;
  subjectKey: string;
  facts: PricingIntelligenceFacts;
  persistence: AIPersistenceRepositories;
  now?: Date;
}): Promise<PricingRecommendationLifecycleEvent[]> {
  const events: PricingRecommendationLifecycleEvent[] = [];
  const now = (input.now ?? new Date()).toISOString();
  const records = await input.persistence.recommendations.listBySubject({
    storeId: input.storeId,
    subjectKey: input.subjectKey,
  });

  for (const record of records) {
    const recommendationId = String(record.payloadJson.id ?? record.stableId);

    if (
      shouldExpirePricingRecommendation({
        facts: input.facts,
        payload: record.payloadJson,
        status: record.status,
      })
    ) {
      const reason =
        getPricingRecommendationExpirationReason({
          facts: input.facts,
          payload: record.payloadJson,
        }) ?? "issue_resolved";

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
        reason,
        at: now,
      });
      continue;
    }

    if (record.status === "implemented") {
      const verifyingPayload = withTimeline(record.payloadJson, {
        verifying: readTimeline(record.payloadJson).verifying ?? now,
      });

      if (
        getPricingRecommendationVerificationReason({
          facts: input.facts,
          payload: record.payloadJson,
        })
      ) {
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

export async function recordPricingMerchantRecommendationFeedback(input: {
  storeId: string;
  subjectKey: string;
  stableId: string;
  feedback: "implement" | "dismiss" | "ignore" | "snooze";
  persistence: AIPersistenceRepositories;
  now?: Date;
}) {
  const now = (input.now ?? new Date()).toISOString();
  const records = await input.persistence.recommendations.listBySubject({
    storeId: input.storeId,
    subjectKey: input.subjectKey,
  });
  const record = records.find((item) => item.stableId === input.stableId);

  if (!record) {
    throw new Error("pricing_recommendation_not_found");
  }

  const statusMap = {
    implement: "implemented",
    dismiss: "dismissed",
    ignore: "dismissed",
    snooze: "open",
  } as const;

  const payloadJson = {
    ...record.payloadJson,
    feedback: input.feedback,
    ...(input.feedback === "snooze" ? { snoozedUntil: now } : {}),
    recommendationTimeline: {
      ...readTimeline(record.payloadJson),
      ...(input.feedback === "implement" ? { implemented: now, verifying: now } : {}),
    },
  };

  await input.persistence.recommendations.updateStatus({
    storeId: input.storeId,
    stableId: input.stableId,
    status: statusMap[input.feedback],
  });

  await input.persistence.recommendations.upsertMany([
    {
      ...record,
      status: statusMap[input.feedback],
      payloadJson,
    },
  ]);
}
