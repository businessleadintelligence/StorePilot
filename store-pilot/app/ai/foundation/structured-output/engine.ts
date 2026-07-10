import type { z } from "zod";

import { AIPlatformError } from "../../core/ai-errors";
import { validateStructuredOutput } from "../../core/ai-output";
import { attemptJsonRepair } from "./json-repair";

export type StructuredOutputEngineOptions<TSchema extends z.ZodTypeAny> = {
  schema: TSchema;
  schemaName: string;
  strict?: boolean;
  maxRepairAttempts?: number;
};

export type StructuredOutputEngineResult<TOutput> = {
  data: TOutput;
  repairAttempts: number;
  usedRepair: boolean;
};

export function runStructuredOutputEngine<TSchema extends z.ZodTypeAny>(
  rawContent: string,
  options: StructuredOutputEngineOptions<TSchema>,
): StructuredOutputEngineResult<z.infer<TSchema>> {
  const maxRepairAttempts = options.maxRepairAttempts ?? 2;
  let repairAttempts = 0;
  let lastError: unknown;

  const candidates = [rawContent];
  for (let index = 0; index < maxRepairAttempts; index += 1) {
    candidates.push(rawContent);
  }

  for (const candidate of candidates) {
    try {
      const payload =
        repairAttempts === 0
          ? JSON.parse(extractJson(candidate))
          : attemptJsonRepair(candidate);
      const validated = validateStructuredOutput(options.schema, payload);
      return {
        data: validated.data,
        repairAttempts,
        usedRepair: repairAttempts > 0,
      };
    } catch (error) {
      lastError = error;
      repairAttempts += 1;
    }
  }

  throw AIPlatformError.schemaValidation(
    `Structured output failed for ${options.schemaName}`,
    lastError,
  );
}

function extractJson(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }
  throw AIPlatformError.invalidResponse("Provider response did not contain JSON");
}
