import type { AutomationVerificationRule, StoreAutomation } from "./automation-types";

export function evaluateAutomationVerificationRules(
  rules: AutomationVerificationRule[],
  signals: Record<string, number | boolean | string>,
): AutomationVerificationRule[] {
  return rules.map((rule) => {
    const signal = signals[rule.metric];
    let satisfied = false;
    if (rule.target === "true") satisfied = Boolean(signal);
    else if (rule.target === ">0") satisfied = Number(signal) > 0;
    else satisfied = Boolean(signal);
    return { ...rule, satisfied };
  });
}

export function canVerifyAutomation(automation: StoreAutomation): boolean {
  return automation.verificationRules.every((rule) => rule.satisfied);
}

export function applyVerificationSignals(
  automation: StoreAutomation,
  signals: Record<string, number | boolean | string>,
): StoreAutomation {
  const verificationRules = evaluateAutomationVerificationRules(automation.verificationRules, signals);
  return {
    ...automation,
    verificationRules,
    updatedAt: new Date().toISOString(),
  };
}
