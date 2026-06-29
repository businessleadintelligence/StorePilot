import type { SeoIntelligenceFacts } from "../ai/facts/seo-intelligence-facts";
import type { AIPersistenceRepositories } from "../ai/persistence/types";
import {
  getSeoRecommendationExpirationReason,
  getSeoRecommendationVerificationReason,
  shouldExpireSeoRecommendation,
} from "../ai/agents/seo-intelligence-expiration";

export type SeoRecommendationLifecycleEvent = {
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

export async function processSeoIntelligenceLifecycle(input: {
  storeId: string;
  subjectKey: string;
  facts: SeoIntelligenceFacts;
  persistence: AIPersistenceRepositories;
  now?: Date;
}): Promise<SeoRecommendationLifecycleEvent[]> {
  const events: SeoRecommendationLifecycleEvent[] = [];
  const now = (input.now ?? new Date()).toISOString();
  const records = await input.persistence.recommendations.listBySubject({
    storeId: input.storeId,
    subjectKey: input.subjectKey,
  });

  for (const record of records) {
    const recommendationId = String(record.payloadJson.id ?? record.stableId);

    if (
      shouldExpireSeoRecommendation({
        facts: input.facts,
        payload: record.payloadJson,
        status: record.status,
      })
    ) {
      const reason =
        getSeoRecommendationExpirationReason({
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
        getSeoRecommendationVerificationReason({
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

export async function recordSeoMerchantRecommendationFeedback(input: {
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
    throw new Error("seo_recommendation_not_found");
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
