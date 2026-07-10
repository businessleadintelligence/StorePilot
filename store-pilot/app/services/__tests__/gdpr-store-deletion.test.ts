import { beforeEach, describe, expect, it, vi } from "vitest";

import prisma from "../../db.server";
import {
  STORE_DELETION_DELEGATES,
  deleteAllStoreDataInTransaction,
} from "../gdpr-store-deletion.server";
import { handleShopRedactWebhook } from "../gdpr.server";
import { SHOP, STORE_ID, testHarness } from "./helpers/fixtures";

function buildShopRedactPayload(): Record<string, unknown> {
  return {
    shop_id: 954889,
    shop_domain: SHOP,
  };
}

function createDeletionTxMock() {
  const tx = Object.fromEntries(
    STORE_DELETION_DELEGATES.map((delegate) => [
      delegate,
      {
        deleteMany: vi.fn(async () => ({ count: 0 })),
      },
    ]),
  ) as Record<
    (typeof STORE_DELETION_DELEGATES)[number],
    { deleteMany: ReturnType<typeof vi.fn> }
  >;

  return tx;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Epic 1.1 GDPR store deletion completeness", () => {
  it("1. deletes every store-scoped delegate in FK-safe order", async () => {
    const tx = createDeletionTxMock();

    await deleteAllStoreDataInTransaction(tx as never, STORE_ID);

    for (const delegate of STORE_DELETION_DELEGATES) {
      expect(tx[delegate].deleteMany).toHaveBeenCalledWith({
        where: { storeId: STORE_ID },
      });
    }

    const callOrder = STORE_DELETION_DELEGATES.flatMap((delegate) =>
      tx[delegate].deleteMany.mock.invocationCallOrder,
    );
    expect(callOrder).toEqual([...callOrder].sort((left, right) => left - right));
  });

  it("2. shop redact invokes comprehensive deletion inside a transaction", async () => {
    const harness = testHarness();
    harness.seedProduct({ shopifyVariantId: "gid://shopify/ProductVariant/gdpr-intel" });

    const deleteManySpy = vi.spyOn(prisma.evidence, "deleteMany");
    const graphSpy = vi.spyOn(prisma.knowledgeGraphNode, "deleteMany");
    const rootCauseSpy = vi.spyOn(prisma.rootCause, "deleteMany");
    const experimentSpy = vi.spyOn(prisma.experiment, "deleteMany");
    const executiveSpy = vi.spyOn(prisma.executiveDecision, "deleteMany");

    const result = await handleShopRedactWebhook({
      shop: SHOP,
      topic: "shop/redact",
      webhookId: "wh-epic1-intel-delete",
      payload: buildShopRedactPayload(),
    });

    expect(result.action).toBe("shop_redacted");
    expect(deleteManySpy).toHaveBeenCalledWith({ where: { storeId: STORE_ID } });
    expect(graphSpy).toHaveBeenCalledWith({ where: { storeId: STORE_ID } });
    expect(rootCauseSpy).toHaveBeenCalledWith({ where: { storeId: STORE_ID } });
    expect(experimentSpy).toHaveBeenCalledWith({ where: { storeId: STORE_ID } });
    expect(executiveSpy).toHaveBeenCalledWith({ where: { storeId: STORE_ID } });
    expect(harness.dbState.stores).toHaveLength(0);
  });
});
