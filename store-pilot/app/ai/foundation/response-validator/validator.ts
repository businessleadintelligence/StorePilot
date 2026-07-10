import { assertConfidenceRange, assertPriorityRange } from "../../core/ai-output";
import { AIPlatformError } from "../../core/ai-errors";
import type { FoundationValidationRule } from "../types/foundation-types";

export function createStandardValidationRules<
  T extends {
    confidence?: number;
    priority?: number;
  },
>(): FoundationValidationRule<T>[] {
  return [
    {
      id: "confidence_range",
      description: "confidence must be between 0 and 1",
      validate(payload) {
        if (payload.confidence !== undefined) {
          assertConfidenceRange(payload.confidence);
        }
      },
    },
    {
      id: "priority_range",
      description: "priority must be between 1 and 5",
      validate(payload) {
        if (payload.priority !== undefined) {
          assertPriorityRange(payload.priority);
        }
      },
    },
  ];
}

export function rejectUnknownFields<T extends Record<string, unknown>>(
  payload: T,
  allowedFields: Array<keyof T>,
): void {
  const allowed = new Set(allowedFields as string[]);
  for (const key of Object.keys(payload)) {
    if (!allowed.has(key)) {
      throw AIPlatformError.businessRuleValidation(`Unknown field rejected: ${key}`);
    }
  }
}

export function runResponseValidation<T>(
  payload: T,
  rules: FoundationValidationRule<T>[],
): void {
  for (const rule of rules) {
    rule.validate(payload);
  }
}

export function validateEnumField<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
): asserts value is T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw AIPlatformError.businessRuleValidation(
      `${field} must be one of: ${allowed.join(", ")}`,
    );
  }
}
