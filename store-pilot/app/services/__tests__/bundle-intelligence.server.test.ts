import { describe, expect, it } from "vitest";

import {
  buildBundleDiscoverySubjectKey,
  executeBundleDiscovery,
} from "../bundle-intelligence.server";

describe("Bundle Intelligence server", () => {
  it("builds bundle subject keys", () => {
    expect(buildBundleDiscoverySubjectKey("store-42")).toBe("bundle:store-42");
  });

  it("exports executeBundleDiscovery as public API", () => {
    expect(typeof executeBundleDiscovery).toBe("function");
  });
});
