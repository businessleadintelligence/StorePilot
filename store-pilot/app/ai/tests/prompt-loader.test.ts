import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { parsePromptFile } from "../prompts/prompt-loader";
import { createFilePromptLoader } from "../prompts/file-prompt-loader";
import { AIPlatformError } from "../core/ai-errors";

const PROMPTS_DIR = join(process.cwd(), "app", "ai", "prompts");

describe("Prompt loading", () => {
  it("parses markdown frontmatter and body", () => {
    const parsed = parsePromptFile(
      `---
id: demo.prompt
version: 1.0.0
description: Demo prompt
expectedSchema: product-recommendation
---

Prompt body`,
      "demo.prompt.md",
    );

    expect(parsed.metadata.id).toBe("demo.prompt");
    expect(parsed.body).toBe("Prompt body");
  });

  it("loads prompt files from disk", async () => {
    const loader = createFilePromptLoader({ promptsDirectory: PROMPTS_DIR });
    const prompt = await loader.load("platform.template");

    expect(prompt.metadata.expectedSchema).toBe("product-recommendation");
    expect(prompt.body).toContain("StorePilot reasoning assistant");
  });

  it("throws platform error when prompt is missing", async () => {
    const loader = createFilePromptLoader({ promptsDirectory: PROMPTS_DIR });
    await expect(loader.load("missing.prompt")).rejects.toBeInstanceOf(AIPlatformError);
  });

  it("lists available prompt metadata", async () => {
    const loader = createFilePromptLoader({ promptsDirectory: PROMPTS_DIR });
    const prompts = await loader.list();
    expect(prompts.some((prompt) => prompt.id === "platform.template")).toBe(true);
  });
});
