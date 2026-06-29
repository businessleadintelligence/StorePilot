import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { AIPlatformError } from "../core/ai-errors";
import {
  parsePromptFile,
  type LoadedPrompt,
  type PromptLoader,
  type PromptLoaderOptions,
  type PromptMetadata,
} from "./prompt-loader";

export function createFilePromptLoader(options: PromptLoaderOptions): PromptLoader {
  const cache = new Map<string, LoadedPrompt>();

  return {
    async load(promptId: string): Promise<LoadedPrompt> {
      if (cache.has(promptId)) {
        return cache.get(promptId)!;
      }

      const filePath = resolvePromptPath(options.promptsDirectory, promptId);
      if (!filePath) {
        throw AIPlatformError.promptNotFound(promptId);
      }

      const content = readFileSync(filePath, "utf8");
      const loaded = parsePromptFile(content, filePath);
      cache.set(promptId, loaded);
      return loaded;
    },

    async list(): Promise<PromptMetadata[]> {
      const entries = readdirSync(options.promptsDirectory, { withFileTypes: true });
      const prompts: PromptMetadata[] = [];

      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".md")) {
          continue;
        }

        const content = readFileSync(join(options.promptsDirectory, entry.name), "utf8");
        prompts.push(parsePromptFile(content, join(options.promptsDirectory, entry.name)).metadata);
      }

      return prompts.sort((left, right) => left.id.localeCompare(right.id));
    },
  };
}

function resolvePromptPath(promptsDirectory: string, promptId: string): string | null {
  const candidates = [`${promptId}.md`, `${promptId.replaceAll(".", "/")}.md`];

  for (const candidate of candidates) {
    const fullPath = join(promptsDirectory, candidate);
    try {
      readFileSync(fullPath);
      return fullPath;
    } catch {
      continue;
    }
  }

  return null;
}
