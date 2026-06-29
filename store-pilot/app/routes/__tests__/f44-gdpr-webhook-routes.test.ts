import { beforeEach, describe, expect, it, vi } from "vitest";

import { action as dataRequestAction } from "../webhooks.customers.data_request";
import { action as customerRedactAction } from "../webhooks.customers.redact";
import { action as shopRedactAction } from "../webhooks.shop.redact";
import {
  handleCustomersDataRequestWebhook,
  handleCustomersRedactWebhook,
  handleShopRedactWebhook,
} from "../../services/gdpr.server";
import { validateWebhookRequest } from "../../shopify.server";

vi.mock("../../shopify.server", () => ({
  validateWebhookRequest: vi.fn(),
}));

vi.mock("../../services/gdpr.server", () => ({
  handleCustomersDataRequestWebhook: vi.fn(),
  handleCustomersRedactWebhook: vi.fn(),
  handleShopRedactWebhook: vi.fn(),
}));

const SHOP = "storepilot-test.myshopify.com";

function createRequest(): Request {
  return new Request("http://localhost/webhooks/customers/data_request", {
    method: "POST",
    body: JSON.stringify({ customer: { id: 1 } }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("F.4.4 GDPR Webhook Routes", () => {
  it("1. customers/data_request validates webhook and returns 200", async () => {
    vi.mocked(validateWebhookRequest).mockResolvedValue({
      shop: SHOP,
      topic: "customers/data_request",
      webhookId: "wh-route-data",
      payload: { customer: { id: 1 } },
    });
    vi.mocked(handleCustomersDataRequestWebhook).mockResolvedValue({
      success: true,
      action: "customer_data_exported",
    });

    const response = await dataRequestAction({
      request: createRequest(),
    } as Parameters<typeof dataRequestAction>[0]);

    expect(response.status).toBe(200);
    expect(validateWebhookRequest).toHaveBeenCalledTimes(1);
    expect(handleCustomersDataRequestWebhook).toHaveBeenCalledWith({
      shop: SHOP,
      topic: "customers/data_request",
      webhookId: "wh-route-data",
      payload: { customer: { id: 1 } },
    });
  });

  it("2. customers/redact validates webhook and returns 200", async () => {
    vi.mocked(validateWebhookRequest).mockResolvedValue({
      shop: SHOP,
      topic: "customers/redact",
      webhookId: "wh-route-redact",
      payload: { customer: { id: 2 } },
    });
    vi.mocked(handleCustomersRedactWebhook).mockResolvedValue({
      success: true,
      action: "customer_redacted",
    });

    const response = await customerRedactAction({
      request: createRequest(),
    } as Parameters<typeof customerRedactAction>[0]);

    expect(response.status).toBe(200);
    expect(handleCustomersRedactWebhook).toHaveBeenCalledTimes(1);
  });

  it("3. shop/redact validates webhook and returns 200", async () => {
    vi.mocked(validateWebhookRequest).mockResolvedValue({
      shop: SHOP,
      topic: "shop/redact",
      webhookId: "wh-route-shop",
      payload: { shop_domain: SHOP },
    });
    vi.mocked(handleShopRedactWebhook).mockResolvedValue({
      success: true,
      action: "shop_redacted",
    });

    const response = await shopRedactAction({
      request: createRequest(),
    } as Parameters<typeof shopRedactAction>[0]);

    expect(response.status).toBe(200);
    expect(handleShopRedactWebhook).toHaveBeenCalledTimes(1);
  });

  it("4. returns 500 when GDPR handler throws", async () => {
    vi.mocked(validateWebhookRequest).mockResolvedValue({
      shop: SHOP,
      topic: "customers/data_request",
      webhookId: "wh-route-fail",
      payload: { customer: { id: 1 } },
    });
    vi.mocked(handleCustomersDataRequestWebhook).mockRejectedValue(
      new Error("missing_customer"),
    );

    const response = await dataRequestAction({
      request: createRequest(),
    } as Parameters<typeof dataRequestAction>[0]);

    expect(response.status).toBe(500);
  });

  it("5. propagates HMAC validation failures from validateWebhookRequest", async () => {
    vi.mocked(validateWebhookRequest).mockRejectedValue(
      new Response(undefined, { status: 401 }),
    );

    await expect(
      dataRequestAction({
        request: createRequest(),
      } as Parameters<typeof dataRequestAction>[0]),
    ).rejects.toEqual(new Response(undefined, { status: 401 }));

    expect(handleCustomersDataRequestWebhook).not.toHaveBeenCalled();
  });
});
