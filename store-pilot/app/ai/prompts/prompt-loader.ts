export type PromptMetadata = {
  id: string;
  version: string;
  description: string;
  expectedSchema: string;
};

export type LoadedPrompt = {
  metadata: PromptMetadata;
  body: string;
  filePath: string;
};

export type PromptLoaderOptions = {
  promptsDirectory: string;
};

export type PromptLoader = {
  load(promptId: string): Promise<LoadedPrompt>;
  list(): Promise<PromptMetadata[]>;
};

export function parsePromptFile(content: string, filePath: string): LoadedPrompt {
  const trimmed = content.trim();

  if (!trimmed.startsWith("---")) {
    throw new Error(`Prompt file missing frontmatter: ${filePath}`);
  }

  const closingIndex = trimmed.indexOf("\n---", 3);
  if (closingIndex === -1) {
    throw new Error(`Prompt file frontmatter not closed: ${filePath}`);
  }

  const frontmatter = trimmed.slice(3, closingIndex).trim();
  const body = trimmed.slice(closingIndex + 4).trim();
  const metadata = parseFrontmatter(frontmatter, filePath);

  return {
    metadata,
    body,
    filePath,
  };
}

function parseFrontmatter(raw: string, filePath: string): PromptMetadata {
  const fields: Record<string, string> = {};

  for (const line of raw.split("\n")) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim().replace(/^"|"$/g, "");
    fields[key] = value;
  }

  const required = ["id", "version", "description", "expectedSchema"] as const;
  for (const key of required) {
    if (!fields[key]) {
      throw new Error(`Prompt file missing ${key}: ${filePath}`);
    }
  }

  return {
    id: fields.id,
    version: fields.version,
    description: fields.description,
    expectedSchema: fields.expectedSchema,
  };
}
