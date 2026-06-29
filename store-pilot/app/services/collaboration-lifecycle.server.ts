import type { CollaborationContext } from "../ai/collaboration/collaboration-types";
import type { AIPersistenceRepositories } from "../ai/persistence/types";

export type CollaborationLifecycleEvent = {
  stableId: string;
  executiveActionId: string;
  fromStatus: string;
  toStatus: string;
  reason: string;
  at: string;
};

function readTimeline(payload: Record<string, unknown>) {
  return (payload.timeline as Record<string, unknown> | undefined) ?? {};
}

function withTimeline(payload: Record<string, unknown>, patch: Record<string, unknown>) {
  return { ...payload, timeline: { ...readTimeline(payload), ...patch } };
}

export async function processCollaborationLifecycle(input: {
  storeId: string;
  subjectKey: string;
  context: CollaborationContext;
  persistence: AIPersistenceRepositories;
  now?: Date;
}): Promise<CollaborationLifecycleEvent[]> {
  const events: CollaborationLifecycleEvent[] = [];
  const now = (input.now ?? new Date()).toISOString();
  const records = await input.persistence.recommendations.listBySubject({
    storeId: input.storeId,
    subjectKey: input.subjectKey,
  });

  for (const record of records) {
    const payload = (record.payloadJson ?? {}) as Record<string, unknown>;
    const executiveActionId = String(payload.executiveActionId ?? payload.id ?? record.stableId);
    const sourceRecommendationIds = Array.isArray(payload.sourceRecommendationIds)
      ? payload.sourceRecommendationIds.map(String)
      : [];

    if (record.status === "implemented") {
      const allImplemented = sourceRecommendationIds.every((id) =>
        input.context.memory.implementedIds.has(id),
      );
      const anyVerified = sourceRecommendationIds.some((id) =>
        input.context.recommendations.find((item) => item.recommendationId === id)?.status === "verified",
      );

      if (allImplemented || anyVerified) {
        await input.persistence.recommendations.updateStatus({
          storeId: input.storeId,
          stableId: record.stableId,
          status: "verified",
        });
        await input.persistence.recommendations.upsertMany([
          {
            ...record,
            status: "verified",
            payloadJson: withTimeline(payload, { verified: now }),
          },
        ]);
        events.push({
          stableId: record.stableId,
          executiveActionId,
          fromStatus: record.status,
          toStatus: "verified",
          reason: "source_recommendations_verified",
          at: now,
        });
      }
    }

    if (record.status === "open" && payload.requiresManualReview && payload.conflicts) {
      const conflicts = payload.conflicts as unknown[];
      if (Array.isArray(conflicts) && conflicts.length === 0) {
        await input.persistence.recommendations.upsertMany([
          {
            ...record,
            payloadJson: { ...payload, requiresManualReview: false },
          },
        ]);
      }
    }
  }

  return events;
}

export async function recordCollaborationMerchantFeedback(input: {
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
  if (!record) throw new Error("collaboration_recommendation_not_found");

  const statusMap = {
    implement: "implemented",
    dismiss: "dismissed",
    ignore: "dismissed",
    snooze: "open",
  } as const;

  await input.persistence.recommendations.updateStatus({
    storeId: input.storeId,
    stableId: input.stableId,
    status: statusMap[input.feedback],
  });
  await input.persistence.recommendations.upsertMany([
    {
      ...record,
      status: statusMap[input.feedback],
      payloadJson: {
        ...record.payloadJson,
        feedback: input.feedback,
        ...(input.feedback === "snooze" ? { snoozedUntil: now } : {}),
        timeline: {
          ...readTimeline(record.payloadJson as Record<string, unknown>),
          ...(input.feedback === "implement" ? { implemented: now, verifying: now } : {}),
        },
      },
    },
  ]);
}
