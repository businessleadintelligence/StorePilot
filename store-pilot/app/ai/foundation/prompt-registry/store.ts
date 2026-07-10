import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { parsePromptFile } from "../../prompts/prompt-loader";
import type { FoundationPromptDefinition } from "../types/foundation-types";
import type { PromptRegistryStore } from "./registry";
import { InMemoryPromptRegistry } from "./registry";

export type FileBackedPromptRegistryOptions = {
  promptsDirectory?: string;
  author?: string;
};

export class FileBackedPromptRegistry implements PromptRegistryStore {
  private readonly memory = new InMemoryPromptRegistry();
  private readonly promptsDirectory: string;
  private readonly author: string;

  constructor(options: FileBackedPromptRegistryOptions = {}) {
    this.promptsDirectory =
      options.promptsDirectory ?? join(process.cwd(), "app", "ai", "prompts");
    this.author = options.author ?? "storepilot-platform";
  }

  register(prompt: FoundationPromptDefinition): void {
    this.memory.register(prompt);
  }

  get(promptId: string, version?: string): FoundationPromptDefinition | null {
    const cached = this.memory.get(promptId, version);
    if (cached) {
      return cached;
    }

    const filePath = resolvePromptPath(this.promptsDirectory, promptId);
    if (!filePath) {
      return null;
    }

    try {
      const loaded = parsePromptFile(readFileSync(filePath, "utf8"), filePath);
      const definition: FoundationPromptDefinition = {
        id: loaded.metadata.id,
        version: loaded.metadata.version,
        author: this.author,
        description: loaded.metadata.description,
        body: loaded.body,
        inputSchema: "object",
        outputSchema: loaded.metadata.expectedSchema,
        temperature: 0.2,
        defaultTier: "standard",
        createdAt: new Date().toISOString(),
      };
      this.memory.register(definition);
      if (version && definition.version !== version) {
        return this.memory.get(promptId, version);
      }
      return definition;
    } catch {
      return null;
    }
  }

  list(promptId: string): FoundationPromptDefinition[] {
    const existing = this.memory.list(promptId);
    if (existing.length > 0) {
      return existing;
    }
    const loaded = this.get(promptId);
    return loaded ? [loaded] : [];
  }
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

export function createDefaultPromptRegistry(
  options?: FileBackedPromptRegistryOptions,
): PromptRegistryStore {
  const promptsDirectory =
    options?.promptsDirectory ?? resolveDefaultPromptsDirectory();
  return new FileBackedPromptRegistry({ ...options, promptsDirectory });
}

export function resolveDefaultPromptsDirectory(): string {
  const candidates = [
    join(process.cwd(), "app", "ai", "prompts"),
    join(process.cwd(), "build", "server", "app", "ai", "prompts"),
    join(
      process.cwd(),
      "store-pilot",
      "build",
      "server",
      "app",
      "ai",
      "prompts",
    ),
    join(process.cwd(), "store-pilot", "app", "ai", "prompts"),
  ];

  try {
    if (typeof import.meta !== "undefined" && import.meta.url) {
      candidates.unshift(
        join(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "prompts"),
        join(
          fileURLToPath(new URL(".", import.meta.url)),
          "..",
          "..",
          "..",
          "app",
          "ai",
          "prompts",
        ),
      );
    }
  } catch {
    // ignore — non-ESM runtime
  }

  try {
    const serverRoot = join(process.cwd(), "build", "server");
    for (const entry of readdirSync(serverRoot, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        candidates.push(join(serverRoot, entry.name, "app", "ai", "prompts"));
      }
    }
  } catch {
    // ignore — not a bundled server layout
  }

  for (const directory of candidates) {
    try {
      readdirSync(directory);
      return directory;
    } catch {
      continue;
    }
  }

  return join(process.cwd(), "app", "ai", "prompts");
}

export function bootstrapPromptRegistryFromDirectory(
  directory: string,
  author = "storepilot-platform",
): InMemoryPromptRegistry {
  const registry = new InMemoryPromptRegistry();
  const entries = readdirSync(directory, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) {
      continue;
    }
    const filePath = join(directory, entry.name);
    const loaded = parsePromptFile(readFileSync(filePath, "utf8"), filePath);
    registry.register({
      id: loaded.metadata.id,
      version: loaded.metadata.version,
      author,
      description: loaded.metadata.description,
      body: loaded.body,
      inputSchema: "object",
      outputSchema: loaded.metadata.expectedSchema,
      temperature: 0.2,
      defaultTier: "standard",
      createdAt: new Date().toISOString(),
    });
  }

  return registry;
}
