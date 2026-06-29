export type ExecutiveDependencyNode = {
  id: string;
  label: string;
  agentId: string;
  dependsOn: string[];
};

export type ExecutiveDependencyEdge = {
  from: string;
  to: string;
  reason: string;
};

export function buildExecutiveDependencyGraph(input: {
  nodes: ExecutiveDependencyNode[];
  collaborationDependencies: Array<{
    recommendationId: string;
    dependsOn: string[];
    reason: string;
  }>;
}): {
  nodes: ExecutiveDependencyNode[];
  edges: ExecutiveDependencyEdge[];
  blockedChainCount: number;
  rootCount: number;
} {
  const edges: ExecutiveDependencyEdge[] = [];
  const nodeIds = new Set(input.nodes.map((node) => node.id));

  for (const node of input.nodes) {
    for (const dependencyId of node.dependsOn) {
      if (!nodeIds.has(dependencyId)) continue;
      edges.push({
        from: dependencyId,
        to: node.id,
        reason: "prerequisite_action",
      });
    }
  }

  for (const dependency of input.collaborationDependencies) {
    if (!nodeIds.has(dependency.recommendationId)) continue;
    for (const parentId of dependency.dependsOn) {
      if (!nodeIds.has(parentId)) continue;
      edges.push({
        from: parentId,
        to: dependency.recommendationId,
        reason: dependency.reason || "collaboration_dependency",
      });
    }
  }

  const dependents = new Map<string, number>();
  for (const edge of edges) {
    dependents.set(edge.from, (dependents.get(edge.from) ?? 0) + 1);
  }

  const rootCount = input.nodes.filter((node) => node.dependsOn.length === 0).length;
  const blockedChainCount = input.nodes.filter((node) => node.dependsOn.length >= 2).length;

  return { nodes: input.nodes, edges, blockedChainCount, rootCount };
}

export function findDependencyBlockers(
  graph: { edges: ExecutiveDependencyEdge[] },
  completedIds: Set<string>,
): string[] {
  const blocked = new Set<string>();
  for (const edge of graph.edges) {
    if (!completedIds.has(edge.from)) {
      blocked.add(edge.to);
    }
  }
  return [...blocked];
}
