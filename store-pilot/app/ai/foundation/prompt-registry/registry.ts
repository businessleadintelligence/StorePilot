import { AIPlatformError } from "../../core/ai-errors";
import type { FoundationPromptDefinition } from "../types/foundation-types";
import { buildPromptHash } from "../utils/hash";

export type PromptRegistryStore = {
  get(promptId: string, version?: string): FoundationPromptDefinition | null;
  list(promptId: string): FoundationPromptDefinition[];
  register(prompt: FoundationPromptDefinition): void;
};

export class InMemoryPromptRegistry implements PromptRegistryStore {
  private readonly prompts = new Map<string, FoundationPromptDefinition>();

  register(prompt: FoundationPromptDefinition): void {
    this.prompts.set(`${prompt.id}:${prompt.version}`, prompt);
  }

  get(promptId: string, version?: string): FoundationPromptDefinition | null {
    if (version) {
      return this.prompts.get(`${promptId}:${version}`) ?? null;
    }

    const versions = this.list(promptId);
    return versions.at(-1) ?? null;
  }

  list(promptId: string): FoundationPromptDefinition[] {
    return [...this.prompts.values()]
      .filter((prompt) => prompt.id === promptId)
      .sort((left, right) => left.version.localeCompare(right.version));
  }
}

export function renderPromptTemplate(
  body: string,
  variables: Record<string, unknown> = {},
): string {
  return body.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, key) => {
    const value = variables[key];
    if (value === undefined || value === null) {
      return "";
    }
    return typeof value === "string" ? value : JSON.stringify(value);
  });
}

export function resolvePromptDefinition(input: {
  registry: PromptRegistryStore;
  promptId: string;
  promptVersion?: string;
}): FoundationPromptDefinition {
  const prompt = input.registry.get(input.promptId, input.promptVersion);
  if (!prompt) {
    throw AIPlatformError.promptNotFound(input.promptId);
  }
  return prompt;
}

export function buildPromptMetadata(prompt: FoundationPromptDefinition): {
  hash: string;
  checksum: string;
} {
  const hash = buildPromptHash({
    promptId: prompt.id,
    promptVersion: prompt.version,
    body: prompt.body,
  });
  return { hash, checksum: hash.slice(0, 16) };
}
