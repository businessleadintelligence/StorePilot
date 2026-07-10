import type { RootCauseRecord } from "../shared/types";

export function traverseCausalGraph(chain: RootCauseRecord["causalChain"]): {
  upstream: string[];
  downstream: string[];
} {
  if (chain.length === 0) {
    return { upstream: [], downstream: [] };
  }

  return {
    upstream: chain.slice(0, -1).map((step) => step.label),
    downstream: chain.slice(-1).map((step) => step.label),
  };
}
