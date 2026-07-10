import { CAUSAL_DOMAIN_RULES } from "../shared/constants";
import type { CausalChainStep, OutcomeDetectionRule } from "../shared/types";

export function isCausalChainAllowed(chain: CausalChainStep[]): boolean {
  if (chain.length < 2) {
    return true;
  }

  const rootDomain = chain[0]?.domain ?? "";
  const outcomeDomain = chain[chain.length - 1]?.domain ?? "";

  for (const rule of CAUSAL_DOMAIN_RULES) {
    if (
      !rule.allowed &&
      rootDomain.includes(rule.causeDomain) &&
      outcomeDomain.includes(rule.outcomeDomain)
    ) {
      return false;
    }
  }

  return true;
}

export function rejectImpossibleCause(input: {
  primaryCauseDomain: string;
  businessOutcome: string;
}): boolean {
  for (const rule of CAUSAL_DOMAIN_RULES) {
    if (
      !rule.allowed &&
      input.primaryCauseDomain.includes(rule.causeDomain) &&
      input.businessOutcome.includes(rule.outcomeDomain)
    ) {
      return true;
    }
  }
  return false;
}

export function validateOutcomeRule(
  rule: OutcomeDetectionRule,
  activeSignals: Set<string>,
): boolean {
  const hasRequired = rule.requiredSignals.every((signal) => activeSignals.has(signal));
  if (!hasRequired) {
    return false;
  }
  return isCausalChainAllowed(rule.chainTemplate);
}
