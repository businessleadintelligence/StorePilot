import { describe, expect, it } from "vitest";

import { isReactRouterDataRequest } from "../react-router-request.server";

describe("isReactRouterDataRequest", () => {
  it("returns true for React Router data requests", () => {
    expect(
      isReactRouterDataRequest(new Request("https://app.example/app.data")),
    ).toBe(true);
    expect(
      isReactRouterDataRequest(
        new Request("https://app.example/app/executive.data"),
      ),
    ).toBe(true);
  });

  it("returns false for document requests", () => {
    expect(
      isReactRouterDataRequest(new Request("https://app.example/app")),
    ).toBe(false);
  });
});
