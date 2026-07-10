import { beforeEach, describe, expect, it, vi } from "vitest";

import prisma from "../../db.server";
import { assertProductCreateAllowedAtomic } from "../billing-enforcement.server";
import { createTrialSubscription } from "../billing.server";
import { STORE_ID, testHarness } from "./helpers/fixtures";

beforeEach(() => {
  testHarness().resetDbState();
  vi.clearAllMocks();
});

describe("billing enforcement raw SQL", () => {
  it("uses quoted storeId column when locking subscriptions (not store_id)", async () => {
    await createTrialSubscription(STORE_ID);
    const queryRaw = vi.spyOn(prisma, "$queryRaw");

    await prisma.$transaction(async (tx) =>
      assertProductCreateAllowedAtomic(tx, STORE_ID),
    );

    const subscriptionLockCall = queryRaw.mock.calls.find((call) => {
      const strings = call[0] as TemplateStringsArray;
      return strings.join("").includes("subscriptions");
    });

    expect(subscriptionLockCall).toBeDefined();
    const sql = (subscriptionLockCall![0] as TemplateStringsArray).join("?");
    expect(sql).toContain('"storeId"');
    expect(sql).not.toContain("store_id");
  });
});
