import { beforeEach, describe, expect, it, vi } from "vitest";
import { action, loader } from "../app.automation";
import { authenticate } from "../../shopify.server";
import { getAutomationCenterData } from "../../services/automation.server";
import { buildEmptyAutomationCenterData } from "../../automation/__tests__/helpers";

vi.mock("../../shopify.server", () => ({
  authenticate: { admin: vi.fn() },
}));

vi.mock("../../db.server", () => ({
  default: {
    store: { findUnique: vi.fn() },
  },
}));

vi.mock("../../services/automation.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/automation.server")>();
  return {
    ...actual,
    getAutomationCenterData: vi.fn(),
    approveAutomation: vi.fn(async () => ({ id: "auto-1", status: "approved" })),
  };
});

beforeEach(() => vi.clearAllMocks());

describe("Automation route", () => {
  it("loads persisted automation center data without invoking AI", async () => {
    vi.mocked(authenticate.admin).mockResolvedValue({
      session: { shop: "storepilot-test.myshopify.com" },
    } as never);
    const prisma = (await import("../../db.server")).default;
    vi.mocked(prisma.store.findUnique).mockResolvedValue({ id: "store-1" } as never);
    vi.mocked(getAutomationCenterData).mockResolvedValue(buildEmptyAutomationCenterData());

    const data = await loader({ request: new Request("http://localhost/app/automation") } as never);
    expect(getAutomationCenterData).toHaveBeenCalled();
    expect(data.automationCenter).toBeTruthy();
  });

  it("approves automation through action", async () => {
    vi.mocked(authenticate.admin).mockResolvedValue({
      session: { shop: "storepilot-test.myshopify.com" },
    } as never);
    const prisma = (await import("../../db.server")).default;
    vi.mocked(prisma.store.findUnique).mockResolvedValue({ id: "store-1" } as never);

    const response = await action({
      request: new Request("http://localhost/app/automation", {
        method: "POST",
        body: new URLSearchParams({ intent: "approve", automationId: "auto-1" }),
      }),
    } as never);

    expect(response.status).toBe(200);
  });
});
