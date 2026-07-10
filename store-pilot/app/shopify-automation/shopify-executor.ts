import type { StoreAutomation } from "../automation/automation-types";
import type { AutomationExecutionResult } from "./execution-result";
import {
  assertWriteProductsPermission,
  resolveShopifyAdminContext,
  type ShopifyAdminContext,
} from "./shopify-admin-client";
import { appendShopifyAuditRecord } from "./shopify-audit";
import { validateAutomationDryRun , resolveShopifyCollectionId, resolveShopifyProductId } from "./shopify-dry-run";
import {
  beginIdempotency,
  buildIdempotencyKey,
  buildMutationHash,
  completeIdempotency,
  getCompletedIdempotencyResult,
} from "./shopify-idempotency";
import { buildMutationDescriptor, executeRegisteredMutation } from "./shopify-mutation-registry";
import { parseAutomationMutationPayload } from "./shopify-mutation-types";
import { buildRollbackMetadata } from "./shopify-rollback";
import { ShopifyExecutionError } from "./shopify-errors";
import { assertMutationVerified } from "./shopify-verification";

export type ShopifyExecutorDependencies = {
  resolveAdminContext?: (storeId: string) => Promise<ShopifyAdminContext>;
};

const defaultDependencies: ShopifyExecutorDependencies = {
  resolveAdminContext: resolveShopifyAdminContext,
};

export async function executeShopifyAutomation(
  automation: StoreAutomation,
  dependencies: ShopifyExecutorDependencies = defaultDependencies,
): Promise<AutomationExecutionResult> {
  const startedAt = Date.now();
  validateAutomationDryRun(automation);

  const mutationDescriptor = buildMutationDescriptor(automation);
  const mutationHash = buildMutationHash(mutationDescriptor);
  const idempotencyKey = buildIdempotencyKey({
    automationId: automation.id,
    storeId: automation.storeId,
    mutationHash,
  });

  const idempotencyState = beginIdempotency({
    key: idempotencyKey,
    automationId: automation.id,
    storeId: automation.storeId,
    mutationHash,
  });

  if (idempotencyState === "duplicate_completed") {
    const cached = getCompletedIdempotencyResult(idempotencyKey);
    if (cached) return cached;
  }

  if (idempotencyState === "duplicate_in_progress") {
    throw new ShopifyExecutionError("validation_error", "Automation execution already in progress", {
      retryable: true,
      details: { idempotencyKey },
    });
  }

  const resolveContext = dependencies.resolveAdminContext ?? resolveShopifyAdminContext;
  const context = await resolveContext(automation.storeId);
  await assertWriteProductsPermission(context);

  const payload = parseAutomationMutationPayload(
    automation.rollbackPlan.beforeState,
    automation.preview.expectedChanges,
  );

  const mutation = await executeRegisteredMutation({
    automation,
    client: context.client,
    storeId: automation.storeId,
  });

  const productId = await resolveShopifyProductId(automation.storeId, payload);
  const collectionId =
    automation.templateId === "move_product_between_collections"
      ? await resolveShopifyCollectionId(automation.storeId, payload)
      : undefined;

  await assertMutationVerified({
    client: context.client,
    storeId: automation.storeId,
    productId,
    collectionId,
    mutation,
  });

  const rollbackMetadata = buildRollbackMetadata({
    mutationType: mutation.mutationType,
    oldValues: mutation.oldValues,
  });

  const executionDurationMs = Date.now() - startedAt;
  const auditRecord = appendShopifyAuditRecord({
    merchantId: payload.merchantId ?? null,
    storeId: automation.storeId,
    automationId: automation.id,
    operationId: automation.operationId,
    mutationType: mutation.mutationType,
    oldValues: mutation.oldValues,
    newValues: mutation.newValues,
    executionResult: "success",
    shopifyRequestId: mutation.shopifyRequestId,
    verificationStatus: "passed",
    rollbackMetadata,
    merchantApprovalTimestamp: automation.timeline.approved,
    executionDurationMs,
  });

  const result: AutomationExecutionResult = {
    automationId: automation.id,
    executedAt: new Date().toISOString(),
    shopifyMutationsExecuted: true,
    simulatedChanges: mutation.appliedChanges,
    message: "Automation executed against Shopify Admin API.",
    auditRecordId: auditRecord.id,
    shopifyRequestId: mutation.shopifyRequestId,
    verificationStatus: "passed",
    rollbackMetadata,
    mutationType: mutation.mutationType,
    oldValues: mutation.oldValues,
    newValues: mutation.newValues,
    executionDurationMs,
    idempotencyKey,
  };

  completeIdempotency(idempotencyKey, result);
  return result;
}
