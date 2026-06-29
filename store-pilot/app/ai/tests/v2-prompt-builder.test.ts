import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { GenericPromptBuilder } from "../builders/prompt-builder";
import { createFilePromptLoader } from "../prompts/file-prompt-loader";

describe("Prompt builder infrastructure", () => {
  it("loads markdown instructions and injects facts separately", async () => {
    const loader = createFilePromptLoader({
      promptsDirectory: join(process.cwd(), "app", "ai", "prompts"),
    });
    const prompt = await loader.load("platform.template");
    const builder = new GenericPromptBuilder<Record<string, unknown>>();

    const built = await builder.build({
      prompt,
      facts: {
        inventoryStatus: "LOW",
        velocity: 9.3,
      },
      merchantContext: {
        timezone: "UTC",
        currency: "USD",
      },
    });

    expect(built.systemMessage).toContain("StorePilot reasoning assistant");
    expect(built.userMessage).toContain("\"velocity\": 9.3");
    expect(built.userMessage).not.toContain("StorePilot reasoning assistant");
    expect(built.promptChecksum).toHaveLength(64);
  });
});
