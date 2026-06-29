import { beforeEach, describe, expect, it, vi } from "vitest";
import { action, loader } from "../app.operations";
import { authenticate } from "../../shopify.server";
import { getOperationsCenterData } from "../../services/operations.server";
import { buildEmptyOperationsCenterData } from "../../operations/__tests__/helpers";

vi.mock("../../shopify.server", () => ({
  authenticate: { admin: vi.fn() },
}));

vi.mock("../../db.server", () => ({
  default: {
    store: { findUnique: vi.fn() },
  },
}));

vi.mock("../../services/operations.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/operations.server")>();
  return {
    ...actual,
    getOperationsCenterData: vi.fn(),
    approveOperation: vi.fn(async () => ({ id: "op-1", status: "approved" })),
  };
});

beforeEach(() => vi.clearAllMocks());

describe("Operations route", () => {
  it("loads persisted operations center data without invoking AI", async () => {
    vi.mocked(authenticate.admin).mockResolvedValue({
      session: { shop: "storepilot-test.myshopify.com" },
    } as never);
    const prisma = (await import("../../db.server")).default;
    vi.mocked(prisma.store.findUnique).mockResolvedValue({ id: "store-1" } as never);
    vi.mocked(getOperationsCenterData).mockResolvedValue(buildEmptyOperationsCenterData());

    const data = await loader({ request: new Request("http://localhost/app/operations") } as never);
    expect(getOperationsCenterData).toHaveBeenCalled();
    expect(data.operationsCenter).toBeTruthy();
  });

  it("approves operation through action", async () => {
    vi.mocked(authenticate.admin).mockResolvedValue({
      session: { shop: "storepilot-test.myshopify.com" },
    } as never);
    const prisma = (await import("../../db.server")).default;
    vi.mocked(prisma.store.findUnique).mockResolvedValue({ id: "store-1" } as never);

    const response = await action({
      request: new Request("http://localhost/app/operations", {
        method: "POST",
        body: new URLSearchParams({ intent: "approve", operationId: "op-1" }),
      }),
    } as never);

    expect(response.status).toBe(200);
  });
});
