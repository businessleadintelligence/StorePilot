import type { z } from "zod";

import { AIPlatformError } from "../core/ai-errors";
import { validateStructuredOutput } from "../core/ai-output";

export type SchemaValidationResult<T> = {
  data: T;
  validationStatus: "valid";
};

export function validateJsonSchema<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  payload: unknown,
): SchemaValidationResult<z.infer<TSchema>> {
  return validateStructuredOutput(schema, payload);
}

export type RetryDecision = {
  shouldRetry: boolean;
  retryCount: number;
};

export function decideMalformedJsonRetry(retryCount: number, maxRetries = 1): RetryDecision {
  return {
    shouldRetry: retryCount < maxRetries,
    retryCount: retryCount + 1,
  };
}

export type ValidationPipelineInput<TSchema extends z.ZodTypeAny, TFacts> = {
  schema: TSchema;
  payload: unknown;
  facts: TFacts;
  retryCount: number;
  validateBusinessRules?: (
    facts: TFacts,
    output: z.infer<TSchema>,
  ) => void | Promise<void>;
};

export type ValidationPipelineResult<TSchema extends z.ZodTypeAny> = {
  ok: true;
  data: z.infer<TSchema>;
  validationStatus: "valid" | "retried";
  retryCount: number;
};

export type ValidationPipelineFailure = {
  ok: false;
  error: AIPlatformError;
  validationStatus: "invalid" | "failed_after_retry";
  retryCount: number;
};

export async function runValidationPipeline<TSchema extends z.ZodTypeAny, TFacts>(
  input: ValidationPipelineInput<TSchema, TFacts>,
): Promise<ValidationPipelineResult<TSchema> | ValidationPipelineFailure> {
  try {
    const validated = validateJsonSchema(input.schema, input.payload);

    if (input.validateBusinessRules) {
      await input.validateBusinessRules(input.facts, validated.data);
    }

    return {
      ok: true,
      data: validated.data,
      validationStatus: input.retryCount > 0 ? "retried" : "valid",
      retryCount: input.retryCount,
    };
  } catch (error) {
    const platformError =
      error instanceof AIPlatformError
        ? error
        : AIPlatformError.schemaValidation(
            "Validation pipeline failed",
            error,
          );

    if (platformError.code !== "schema_validation_failed") {
      return {
        ok: false,
        error: platformError,
        validationStatus: "invalid",
        retryCount: input.retryCount,
      };
    }

    const retry = decideMalformedJsonRetry(input.retryCount);
    if (retry.shouldRetry) {
      return {
        ok: false,
        error: platformError,
        validationStatus: "invalid",
        retryCount: retry.retryCount,
      };
    }

    return {
      ok: false,
      error: platformError,
      validationStatus: "failed_after_retry",
      retryCount: input.retryCount,
    };
  }
}

export function shouldRetryMalformedJson(failure: ValidationPipelineFailure): boolean {
  return (
    failure.validationStatus === "invalid" &&
    failure.error.code === "schema_validation_failed" &&
    failure.retryCount <= 1
  );
}
