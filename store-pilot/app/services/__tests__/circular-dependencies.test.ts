import { execSync } from "node:child_process";

import { describe, expect, it } from "vitest";

describe("Epic 2 architecture — circular dependency guard", () => {
  it("1. app/ has no circular TypeScript imports", () => {
    let output = "";
    try {
      output = execSync("npx madge --circular --extensions ts,tsx app", {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      const execError = error as { stdout?: string; stderr?: string };
      output = `${execError.stdout ?? ""}${execError.stderr ?? ""}`;
    }

    expect(output).not.toMatch(/Found \d+ circular dependencies!/);
  }, 120_000);
});
