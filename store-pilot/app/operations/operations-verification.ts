import type { OperationVerificationRule, StoreOperation } from "./operations-types";

export function evaluateVerificationRules(
  rules: OperationVerificationRule[],
  signals: Record<string, number | boolean | string>,
): OperationVerificationRule[] {
  return rules.map((rule) => {
    const signal = signals[rule.metric];
    let satisfied = false;

    if (rule.target === "true") satisfied = Boolean(signal);
    else if (rule.target === ">0") satisfied = Number(signal) > 0;
    else if (rule.target === "decreased") satisfied = Number(signal) < 0;
    else if (rule.target === "increased") satisfied = Number(signal) > 0;
    else satisfied = Boolean(signal);

    return { ...rule, satisfied };
  });
}

export function canCompleteOperation(operation: StoreOperation): boolean {
  return operation.tasks.every((task) => task.completed);
}

export function canVerifyOperation(operation: StoreOperation): boolean {
  return operation.verificationRules.every((rule) => rule.satisfied);
}

export function markVerificationFromMetrics(
  operation: StoreOperation,
  metrics: Record<string, number | boolean | string>,
): StoreOperation {
  const verificationRules = evaluateVerificationRules(operation.verificationRules, metrics);
  const verificationStatus = verificationRules.every((rule) => rule.satisfied)
    ? "passed"
    : verificationRules.some((rule) => rule.satisfied)
      ? "pending"
      : "failed";

  return {
    ...operation,
    verificationRules,
    verificationStatus,
    updatedAt: new Date().toISOString(),
  };
}
