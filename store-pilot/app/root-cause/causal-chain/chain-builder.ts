import type {
  CausalChainStep,
  OutcomeDetectionRule,
  RootCauseContextBundle,
  SignalSnapshot,
} from "../shared/types";

export function buildCausalChain(input: {
  rule: OutcomeDetectionRule;
  signals: SignalSnapshot[];
  context: RootCauseContextBundle;
}): CausalChainStep[] {
  const evidenceIds = collectEvidenceForRule(input.rule, input.signals, input.context);

  return input.rule.chainTemplate.map((step, index) => ({
    ...step,
    evidenceIds:
      index === input.rule.chainTemplate.length - 1
        ? evidenceIds
        : evidenceIds.slice(0, Math.max(1, Math.floor(evidenceIds.length / 2))),
  }));
}

export function buildCausalGraphEdges(
  chain: CausalChainStep[],
): Array<{
  edgeKey: string;
  fromNodeId: string;
  toNodeId: string;
  relationLabel: string;
  evidenceIds: string[];
  confidence: number;
}> {
  const edges: Array<{
    edgeKey: string;
    fromNodeId: string;
    toNodeId: string;
    relationLabel: string;
    evidenceIds: string[];
    confidence: number;
  }> = [];

  for (let index = 0; index < chain.length - 1; index += 1) {
    const from = chain[index]!;
    const to = chain[index + 1]!;
    edges.push({
      edgeKey: `${from.stepId}:${to.stepId}`,
      fromNodeId: from.stepId,
      toNodeId: to.stepId,
      relationLabel: "CAUSES",
      evidenceIds: [...new Set([...from.evidenceIds, ...to.evidenceIds])],
      confidence: 0.8,
    });
  }

  return edges;
}

function collectEvidenceForRule(
  rule: OutcomeDetectionRule,
  signals: SignalSnapshot[],
  context: RootCauseContextBundle,
): string[] {
  const ids = new Set<string>();

  for (const signalKey of rule.requiredSignals) {
    const signal = signals.find((item) => item.signalKey === signalKey);
    if (signal) {
      signal.evidenceIds.forEach((id) => ids.add(id));
    }
  }

  for (const win of context.quickWins) {
    win.evidenceIds.forEach((id) => ids.add(id));
  }

  return [...ids];
}
