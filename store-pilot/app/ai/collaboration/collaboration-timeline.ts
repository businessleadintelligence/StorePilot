import type { CollaborationOutput } from "./collaboration-types";
import type { CollaborationChartData } from "./collaboration-types";
import { agentLabel } from "./collaboration-utils";

export function buildCollaborationTimelineEvents(output: CollaborationOutput) {
  return [
    { label: "Detected", value: 1 },
    { label: "Synthesized", value: output.executiveActions.length },
    { label: "Conflicts", value: output.conflicts.length },
    { label: "Dependencies", value: output.dependencies.length },
  ];
}

export function buildCollaborationChartData(output: CollaborationOutput): CollaborationChartData {
  const agentInfluence = new Map<string, number>();
  for (const action of output.executiveActions) {
    for (const agent of action.agentsInvolved) {
      agentInfluence.set(agent, (agentInfluence.get(agent) ?? 0) + 1);
    }
  }

  return {
    consensusGauge: [
      { label: "Consensus", value: Math.round(output.consensusScore * 100) },
      { label: "Confidence", value: Math.round(output.overallConfidence * 100) },
    ],
    agentInfluenceRadar: [...agentInfluence.entries()].map(([agent, value]) => ({
      label: agentLabel(agent as never),
      value,
    })),
    dependencyGraph: output.dependencies.map((dependency, index) => ({
      label: `Dep ${index + 1}`,
      value: dependency.dependsOn.length,
    })),
    priorityMatrix: output.executiveActions.map((action) => ({
      label: action.title.slice(0, 18),
      impact: action.estimatedRevenueImpact,
      effort: action.priority,
    })),
    conflictHeatmap: output.conflicts.map((conflict) => ({
      label: conflict.agents.map((agent) => agentLabel(agent)).join(" vs "),
      value: conflict.severity === "high" ? 3 : conflict.severity === "medium" ? 2 : 1,
    })),
    recommendationSankey: output.executiveActions.flatMap((action) =>
      action.agentsInvolved.map((agent) => ({
        label: `${agentLabel(agent)} → ${action.title.slice(0, 12)}`,
        value: 1,
      })),
    ),
    decisionTimeline: buildCollaborationTimelineEvents(output),
    roiWaterfall: output.executiveActions.map((action) => ({
      label: action.title.slice(0, 16),
      value: action.estimatedRevenueImpact,
    })),
    healthWheel: [
      { label: "Overall", value: output.overallHealth },
      { label: "Revenue", value: output.expectedImpact.revenueLift / 100 },
      { label: "Inventory", value: output.expectedImpact.inventoryReduction / 100 },
      { label: "Conversion", value: output.expectedImpact.conversionImprovement * 100 },
    ],
    confidenceDistribution: output.executiveActions.map((action) => ({
      label: action.title.slice(0, 16),
      value: Math.round(action.confidence * 100),
    })),
  };
}
