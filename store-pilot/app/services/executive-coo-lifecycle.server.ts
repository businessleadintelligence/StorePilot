import type { ExecutiveCooFacts } from "../ai/facts/executive-coo-facts";
import type { AIPersistenceRepositories } from "../ai/persistence/types";
import {
  getExecutiveCooPriorityExpirationReason,
  getExecutiveCooPriorityVerificationReason,
  shouldExpireExecutiveCooPriority,
} from "../ai/agents/executive-coo-expiration";

export type ExecutiveCooPriorityLifecycleEvent = {
  stableId: string;
  priorityId: string;
  fromStatus: string;
  toStatus: string;
  reason: string;
  at: string;
};

function readTimeline(payload: Record<string, unknown>) {
  return (payload.priorityTimeline as Record<string, unknown> | undefined) ?? {};
}

function withTimeline(payload: Record<string, unknown>, patch: Record<string, unknown>) {
  return {
    ...payload,
    priorityTimeline: {
      ...readTimeline(payload),
      ...patch,
    },
  };
}

export async function processExecutiveCooLifecycle(input: {
  storeId: string;
  subjectKey: string;
  facts: ExecutiveCooFacts;
  persistence: AIPersistenceRepositories;
  now?: Date;
}): Promise<ExecutiveCooPriorityLifecycleEvent[]> {
  const events: ExecutiveCooPriorityLifecycleEvent[] = [];
  const now = (input.now ?? new Date()).toISOString();
  const records = await input.persistence.recommendations.listBySubject({
    storeId: input.storeId,
    subjectKey: input.subjectKey,
  });

  for (const record of records) {
    const priorityId = String(record.payloadJson.id ?? record.stableId);

    if (
      shouldExpireExecutiveCooPriority({
        facts: input.facts,
        payload: record.payloadJson,
        status: record.status,
      })
    ) {
      const reason =
        getExecutiveCooPriorityExpirationReason({
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
        priorityId,
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
        getExecutiveCooPriorityVerificationReason({
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
          priorityId,
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

export async function recordExecutiveCooMerchantPriorityFeedback(input: {
  storeId: string;
  subjectKey: string;
  stableId: string;
  feedback: "implement" | "dismiss" | "ignore" | "snooze" | "view";
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
    throw new Error("executive_coo_priority_not_found");
  }

  const statusMap = {
    implement: "implemented",
    dismiss: "dismissed",
    ignore: "dismissed",
    snooze: "open",
    view: "viewed",
  } as const;

  const payloadJson = {
    ...record.payloadJson,
    feedback: input.feedback,
    ...(input.feedback === "snooze" ? { snoozedUntil: now } : {}),
    priorityTimeline: {
      ...readTimeline(record.payloadJson),
      ...(input.feedback === "view" ? { viewed: now } : {}),
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
