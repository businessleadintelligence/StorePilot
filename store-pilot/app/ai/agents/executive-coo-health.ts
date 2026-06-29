import type { ExecutiveCooFacts } from "../facts/executive-coo-facts";
import type { ExecutiveCooHealthExplanation } from "../schemas/executive-coo";

export function buildExecutiveCooHealthExplanation(
  facts: ExecutiveCooFacts,
): ExecutiveCooHealthExplanation {
  const drivers = [
    {
      factor: "Operations health",
      direction: facts.operationsHealthScore >= 70 ? ("positive" as const) : ("negative" as const),
      detail: `Operations health is ${facts.operationsHealthScore}/100 across ${facts.agentSnapshots.length} specialist agents.`,
    },
    {
      factor: "Inventory risk",
      direction: facts.inventoryRisk < 40 ? ("positive" as const) : ("negative" as const),
      detail: `Inventory risk score is ${facts.inventoryRisk} with ${facts.strategySignals.criticalInventoryIssues} critical inventory issues.`,
    },
    {
      factor: "Revenue opportunity",
      direction: facts.revenueOpportunity > 0 ? ("positive" as const) : ("neutral" as const),
      detail: `${facts.strategySignals.revenueRecoveryCandidates} revenue recovery candidates are open.`,
    },
    {
      factor: "Agent alignment",
      direction:
        facts.strategySignals.conflictingAgentCount === 0 ? ("positive" as const) : ("negative" as const),
      detail: `${facts.strategySignals.alignedAgentCount} agents are aligned and ${facts.strategySignals.conflictingAgentCount} show elevated conflict risk.`,
    },
  ];

  return {
    score: facts.operationsHealthScore,
    summary:
      facts.operationsHealthScore >= 70
        ? "Operations are stable with actionable priorities ready for merchant execution."
        : "Operations need stabilization before scaling growth or campaign initiatives.",
    drivers,
  };
}
