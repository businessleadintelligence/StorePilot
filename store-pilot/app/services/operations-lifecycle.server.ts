import type { OperationsPersistence } from "../operations/operations-persistence";
import { loadOperationsSnapshot } from "../operations/operations-persistence";
import { archiveOperation, verifyOperation } from "./operations.server";

export async function processOperationsLifecycle(input: {
  storeId: string;
  persistence: OperationsPersistence;
}) {
  const snapshot = await loadOperationsSnapshot(input.storeId, input.persistence);
  const events: Array<{ operationId: string; toStatus: string; reason: string }> = [];

  for (const operation of snapshot.operations) {
    if (operation.status === "verification" && operation.verificationRules.every((rule) => rule.satisfied)) {
      await verifyOperation({
        storeId: input.storeId,
        operationId: operation.id,
        persistence: input.persistence,
      });
      events.push({ operationId: operation.id, toStatus: "verified", reason: "auto_verified" });
    }

    if (operation.status === "verified" && operation.verifiedAt) {
      const verifiedAt = new Date(operation.verifiedAt).getTime();
      if (Date.now() - verifiedAt > 30 * 24 * 60 * 60 * 1000) {
        await archiveOperation({
          storeId: input.storeId,
          operationId: operation.id,
          persistence: input.persistence,
        });
        events.push({ operationId: operation.id, toStatus: "archived", reason: "auto_archived" });
      }
    }
  }

  return events;
}
