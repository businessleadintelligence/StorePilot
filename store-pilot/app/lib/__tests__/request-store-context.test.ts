import { beforeEach, describe, expect, it, vi } from "vitest";

import prisma from "../../db.server";
import { authenticate } from "../../shopify.server";
import {
  authenticateAdminOnce,
  resolveRequestStoreContext,
} from "../request-auth.server";

vi.mock("../../shopify.server", () => ({
  authenticate: {
    admin: vi.fn(),
  },
}));

vi.mock("../../db.server", () => ({
  default: {
    store: {
      findUnique: vi.fn(),
    },
  },
}));

describe("resolveRequestStoreContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authenticate.admin).mockResolvedValue({
      session: { shop: "storepilot-test.myshopify.com" },
    } as never);
    vi.mocked(prisma.store.findUnique).mockResolvedValue({
      id: "store-1",
      currency: "USD",
      shopifyDomain: "storepilot-test.myshopify.com",
    } as never);
  });

  it("deduplicates auth and store lookup within one request", async () => {
    const request = new Request("https://example.com/app");

    const [first, second] = await Promise.all([
      resolveRequestStoreContext(request),
      resolveRequestStoreContext(request),
    ]);

    expect(first).toEqual({
      shop: "storepilot-test.myshopify.com",
      store: {
        id: "store-1",
        currency: "USD",
        shopifyDomain: "storepilot-test.myshopify.com",
      },
      storeId: "store-1",
      currency: "USD",
    });
    expect(second).toBe(first);
    expect(authenticate.admin).toHaveBeenCalledTimes(1);
    expect(prisma.store.findUnique).toHaveBeenCalledTimes(1);
  });

  it("shares auth with authenticateAdminOnce on the same request", async () => {
    const request = new Request("https://example.com/app/products");

    await Promise.all([
      authenticateAdminOnce(request),
      resolveRequestStoreContext(request),
    ]);

    expect(authenticate.admin).toHaveBeenCalledTimes(1);
    expect(prisma.store.findUnique).toHaveBeenCalledTimes(1);
  });
});
